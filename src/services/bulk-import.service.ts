import { AppDataSource } from '../config/datasource';
import { Profile, Gender, AgeGroup } from '../models/Profile.models';
import sysLogger from '../utils/logger';
import { CsvRow } from '../utils/csv-parser';
import { uuidv7 } from 'uuidv7';

export type SkipReason =
  | 'missing_fields'
  | 'invalid_age'
  | 'invalid_gender'
  | 'duplicate_name'
  | 'malformed_row'
  | 'invalid_country'
  | 'invalid_probability';

export type UploadSummary = {
  uploadId: string;
  total_rows: number;
  inserted: number;
  skipped: number;
  reasons: Record<SkipReason, number>;
  duration_ms: number;
  status: 'success' | 'partial' | 'failed';
};

type ValidatedRow = {
  name: string;
  gender: Gender;
  gender_probability: number;
  age: number;
  age_group: AgeGroup;
  country_id: string;
  country_name: string;
  country_probability: number;
};

export class BulkImportService {
  private profileRepository = AppDataSource.getRepository(Profile);

  /**
   * Validate a single CSV row.
   * Returns { valid: true, data } or { valid: false, reason }
   */
  validateRow(
    row: CsvRow,
  ):
    | { valid: true; data: ValidatedRow }
    | { valid: false; reason: SkipReason } {
    const requiredFields = [
      'name',
      'gender',
      'gender_probability',
      'age',
      'age_group',
      'country_id',
      'country_name',
      'country_probability',
    ];

    // 1. Check required fields
    for (const field of requiredFields) {
      if (!row[field] || row[field]!.trim() === '') {
        return { valid: false, reason: 'missing_fields' };
      }
    }

    // 2. Parse and validate age
    const age = parseInt(row['age']!, 10);
    if (isNaN(age) || age < 0 || age > 150) {
      return { valid: false, reason: 'invalid_age' };
    }

    // 3. Validate gender
    const genderLower = row['gender']!.toLowerCase();
    if (!['male', 'female'].includes(genderLower)) {
      return { valid: false, reason: 'invalid_gender' };
    }

    // 4. Validate gender_probability
    const genderProb = parseFloat(row['gender_probability']!);
    if (isNaN(genderProb) || genderProb < 0 || genderProb > 1) {
      return { valid: false, reason: 'invalid_probability' };
    }

    // 5. Validate age_group
    const ageGroupLower = row['age_group']!.toLowerCase();
    const validAgeGroups = ['child', 'teenager', 'adult', 'senior'];
    if (!validAgeGroups.includes(ageGroupLower)) {
      return { valid: false, reason: 'invalid_age' };
    }

    // 6. Validate country_id (2 char code)
    const countryId = row['country_id']!.toUpperCase();
    if (countryId.length !== 2 || !/^[A-Z]{2}$/.test(countryId)) {
      return { valid: false, reason: 'invalid_country' };
    }

    // 7. Validate country_probability
    const countryProb = parseFloat(row['country_probability']!);
    if (isNaN(countryProb) || countryProb < 0 || countryProb > 1) {
      return { valid: false, reason: 'invalid_probability' };
    }

    return {
      valid: true,
      data: {
        name: row['name']!.trim(),
        gender: genderLower as Gender,
        gender_probability: genderProb,
        age,
        age_group: ageGroupLower as AgeGroup,
        country_id: countryId,
        country_name: row['country_name']!.trim(),
        country_probability: countryProb,
      },
    };
  }

  /**
   * Process a batch of validated rows.
   * Checks Redis for existing names to avoid duplicates.
   * Returns count of inserted rows and skip reasons.
   * Does NOT throw on errors; logs and continues.
   */
  async processBatch(
    batch: ValidatedRow[],
    uploadId: string,
    existingNames: Set<string>,
  ): Promise<{ inserted: number; skipped: Record<SkipReason, number> }> {
    const skipped: Record<SkipReason, number> = {
      missing_fields: 0,
      invalid_age: 0,
      invalid_gender: 0,
      duplicate_name: 0,
      malformed_row: 0,
      invalid_country: 0,
      invalid_probability: 0,
    };

    // Filter out duplicates using a local in-memory set for this upload.
    // This avoids one Redis round-trip per row and keeps large files moving.
    const toInsert: ValidatedRow[] = [];
    for (const row of batch) {
      if (existingNames.has(row.name)) {
        skipped.duplicate_name++;
      } else {
        toInsert.push(row);
        existingNames.add(row.name);
      }
    }

    if (toInsert.length === 0) {
      return { inserted: 0, skipped };
    }

    try {
      // Bulk insert using query builder
      const rowsWithId = toInsert.map((r) => ({ id: uuidv7(), ...r }));
      const result = await this.profileRepository
        .createQueryBuilder()
        .insert()
        .into(Profile)
        .values(rowsWithId)
        .orIgnore(true) // Skip on duplicate key (PostgreSQL: ON CONFLICT DO NOTHING)
        .execute();

      const insertedCount = result.identifiers?.length || 0;

      return { inserted: insertedCount, skipped };
    } catch (error) {
      sysLogger.error(`Batch insert error: ${error}`);
      // Return 0 inserted for this batch on error, but don't throw
      return { inserted: 0, skipped };
    }
  }

  /**
   * Fetch existing names only for the current batch.
   * This avoids a full-table preload on every upload.
   */
  async loadExistingNames(names: string[]): Promise<Set<string>> {
    try {
      if (names.length === 0) {
        return new Set<string>();
      }

      const uniqueNames = [...new Set(names)];
      const existingProfiles = await this.profileRepository
        .createQueryBuilder('profile')
        .select(['profile.name'])
        .where('profile.name IN (:...names)', { names: uniqueNames })
        .getMany();

      return new Set(existingProfiles.map((profile) => profile.name));
    } catch (error) {
      sysLogger.error(`Failed to load existing names from DB: ${error}`);
      return new Set<string>();
    }
  }
}

export const bulkImportService = new BulkImportService();
