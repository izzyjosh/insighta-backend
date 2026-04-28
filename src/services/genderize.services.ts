import logger from '../utils/logger';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { BadGatewayError, NotFoundError } from '../utils/api.errors';
import { AppDataSource } from '../config/datasource';
import { Profile, Gender, AgeGroup } from '../models/Profile.models';
import {
  profileResponseSchema,
  ProfileResponseDTO,
  GenderizeResponse,
  AgifyResponse,
  NationalizeResponse,
  NationalizeCountry,
  FilterQueryDTO,
  NaturalSearchDTO,
} from '../schemas/profile.schemas';
import { StatusCodes } from 'http-status-codes';
import { SelectQueryBuilder } from 'typeorm';
import { parseNaturalQuery } from '../utils/natural-query-logic';

type ClassifyResult = {
  profile: ProfileResponseDTO;
  message?: string;
  statusCode: number;
};

type ProfileFilterCriteria = Omit<FilterQueryDTO, 'gender'> & {
  gender?: FilterQueryDTO['gender'] | Array<'male' | 'female'>;
};

countries.registerLocale(enLocale);

class ProfileService {
  private readonly profileRepository = AppDataSource.getRepository(Profile);
  private readonly genderize = 'https://api.genderize.io';
  private readonly agify = 'https://api.agify.io';
  private readonly nationalize = 'https://api.nationalize.io';

  ageGrouping(age: number): string {
    if (age <= 12) return 'child';
    else if (age <= 19) return 'teenager';
    else if (age <= 59) return 'adult';
    else if (age >= 60) return 'senior';
    else return 'unknown';
  }

  private throwUpstreamError(
    apiName: 'Genderize' | 'Agify' | 'Nationalize',
  ): never {
    throw new BadGatewayError(`${apiName} returned an invalid response`, '502');
  }

  private ensureOkResponse(
    response: Response,
    apiName: 'Genderize' | 'Agify' | 'Nationalize',
  ): Response {
    if (!response.ok) {
      this.throwUpstreamError(apiName);
    }
    return response;
  }

  private async applyFilters(
    qb: SelectQueryBuilder<Profile>,
    filters: ProfileFilterCriteria,
  ) {
    if (filters.age_group) {
      qb.andWhere('profile.age_group = :age_group', {
        age_group: filters.age_group,
      });
    }
    if (filters.country_id) {
      qb.andWhere('profile.country_id = :country_id', {
        country_id: filters.country_id,
      });
    }
    if (filters.gender) {
      if (Array.isArray(filters.gender)) {
        qb.andWhere('profile.gender IN (:...gender)', {
          gender: filters.gender,
        });
      } else {
        qb.andWhere('profile.gender = :gender', { gender: filters.gender });
      }
    }

    if (filters.min_age !== undefined) {
      qb.andWhere('profile.age >= :min_age', { min_age: filters.min_age });
    }

    if (filters.max_age !== undefined) {
      qb.andWhere('profile.age <= :max_age', { max_age: filters.max_age });
    }

    if (filters.min_country_probability)
      qb.andWhere('profile.country_probability >= :min_country_probability', {
        min_country_probability: filters.min_country_probability,
      });

    if (filters.min_gender_probability)
      qb.andWhere('profile.gender_probabilty >= :min_gender_probabilty', {
        min_gender_probabilty: filters.min_gender_probability,
      });

    return qb;
  }

  async classify(name: string): Promise<ClassifyResult> {
    try {
      const profile = await this.profileRepository.findOneBy({ name });
      if (profile) {
        return {
          profile: profileResponseSchema.parse(profile),
          message: 'Profile already exists',
          statusCode: StatusCodes.OK,
        };
      }

      const [genderizeFetch, agifyFetch, nationalizeFetch] =
        await Promise.allSettled([
          fetch(`${this.genderize}?name=${encodeURIComponent(name)}`),
          fetch(`${this.agify}?name=${encodeURIComponent(name)}`),
          fetch(`${this.nationalize}?name=${encodeURIComponent(name)}`),
        ]);

      if (genderizeFetch.status === 'rejected') {
        this.throwUpstreamError('Genderize');
      }
      if (agifyFetch.status === 'rejected') {
        this.throwUpstreamError('Agify');
      }
      if (nationalizeFetch.status === 'rejected') {
        this.throwUpstreamError('Nationalize');
      }

      const genderizeResponse = this.ensureOkResponse(
        genderizeFetch.value,
        'Genderize',
      );
      const agifyResponse = this.ensureOkResponse(agifyFetch.value, 'Agify');
      const nationalizeResponse = this.ensureOkResponse(
        nationalizeFetch.value,
        'Nationalize',
      );

      const [genderize, agify, nationalize] = await Promise.all([
        genderizeResponse.json() as Promise<GenderizeResponse>,
        agifyResponse.json() as Promise<AgifyResponse>,
        nationalizeResponse.json() as Promise<NationalizeResponse>,
      ]);

      // edge cases
      if (genderize.gender === null || genderize.count === 0) {
        this.throwUpstreamError('Genderize');
      }
      if (agify.age === null) {
        this.throwUpstreamError('Agify');
      }
      if (nationalize.country.length === 0) {
        this.throwUpstreamError('Nationalize');
      }

      const gender = genderize.gender;
      const age = agify.age;
      const ageGroup = this.ageGrouping(age);
      const countryData = nationalize.country.reduce(
        (max: NationalizeCountry, item: NationalizeCountry) => {
          return item.probability > max.probability ? item : max;
        },
      );

      const countryName = countries.getName(countryData.country_id, 'en');

      const newProfile = this.profileRepository.create();
      newProfile.name = genderize.name;
      newProfile.gender = gender as Gender;
      newProfile.gender_probability = genderize.probability;
      newProfile.age = age;
      newProfile.age_group = ageGroup as AgeGroup;
      newProfile.country_id = countryData.country_id;
      newProfile.country_name = countryName as string;
      newProfile.country_probability = countryData.probability;

      await this.profileRepository.save(newProfile);

      return {
        profile: profileResponseSchema.parse(newProfile),
        statusCode: StatusCodes.CREATED,
      };
    } catch (error: unknown) {
      if (error instanceof BadGatewayError) {
        logger.error(`External API error: ${error.message}`);
        throw error;
      }

      logger.error(
        `Unexpected classify error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async getProfile(id: string) {
    const profile = await this.profileRepository.findOneBy({ id });
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return profileResponseSchema.parse(profile);
  }

  async getAllProfiles(filters: FilterQueryDTO) {
    const page = Math.max(filters.page, 1);
    const limit = Math.max(filters.limit, 1);

    const skip = (page - 1) * limit;

    const baseQuery = this.profileRepository.createQueryBuilder('profile');

    const filteredQuery = await this.applyFilters(baseQuery, filters);

    const profiles = await filteredQuery
      .clone()
      .orderBy(filters.sort_by, filters.order)
      .skip(skip)
      .take(limit)
      .getMany();

    const total = await baseQuery.getCount();

    const profilesMap: ProfileResponseDTO[] = profiles.map((profile: Profile) =>
      profileResponseSchema.parse(profile),
    );
    
    return {
      profiles: profilesMap,
      page: filters.page,
      limit: filters.limit,
      total: total,
    };
  }

  async exportProfiles(filters: FilterQueryDTO) {
    const baseQuery = this.profileRepository.createQueryBuilder('profile');

    const filteredQuery = await this.applyFilters(baseQuery, filters);

    const orderedQuery = filteredQuery.clone().orderBy(filters.sort_by, filters.order);

    const data = await orderedQuery.getMany();

    return data.map((profile) => profileResponseSchema.parse(profile));
  }

  async deleteProfile(id: string) {
    const profile = await this.profileRepository.findOneBy({ id });
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
    await this.profileRepository.remove(profile);
  }

  async naturalSearch(filters: NaturalSearchDTO) {
    const page = Math.max(filters.page, 1);
    const limit = Math.max(filters.limit, 1);

    const skip = (page - 1) * limit;

    const parseSearchQuery = parseNaturalQuery(filters.q);

    const baseQuery = this.profileRepository.createQueryBuilder('profile');

    const naturalFilters: ProfileFilterCriteria = {
      page,
      limit,
      sort_by: 'created_at',
      order: 'DESC',
      ...parseSearchQuery,
    };

    const filteredQuery = await this.applyFilters(baseQuery, naturalFilters);

    const total = await baseQuery.getCount();

    const data = await filteredQuery.clone().skip(skip).take(limit).getMany();
    return {
      profiles: data.map((profile) => profileResponseSchema.parse(profile)),
      page: filters.page,
      limit: filters.limit,
      total,
    };
  }
}

export const profileService = new ProfileService();
