import { SearchFilters } from './natural-query-logic';

type ProfileQueryInput = {
  age_group?: string | null | undefined;
  country_id?: string | null | undefined;
  gender?: string | readonly string[] | null | undefined;
  max_age?: number | null | undefined;
  min_age?: number | null | undefined;
  min_country_probability?: number | null | undefined;
  min_gender_probability?: number | null | undefined;
  limit?: number | null | undefined;
  page?: number | null | undefined;
  sort_by?: string | null | undefined;
  order?: string | null | undefined;
};

type CanonicalFilterValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | CanonicalFilterValue[]
  | { [key: string]: CanonicalFilterValue };

function stableSerialize(value: CanonicalFilterValue): string {
  if (value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        const entryValue = value[key as keyof typeof value];
        return `${JSON.stringify(key)}:${stableSerialize(entryValue)}`;
      });

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeGenderValue(
  gender: string | readonly string[],
): 'male' | 'female' | string | string[] {
  if (typeof gender !== 'string') {
    return [...gender]
      .map((item) => normalizeGenderValue(item))
      .flat()
      .sort();
  }

  const normalized = gender.trim().toLowerCase();

  if (['male', 'males', 'man', 'men'].includes(normalized)) {
    return 'male';
  }

  if (['female', 'females', 'woman', 'women'].includes(normalized)) {
    return 'female';
  }

  return normalized;
}

/**
 * Normalize SearchFilters into a canonical string for consistent cache keys.
 * Ensures different query phrasings with identical meaning produce the same key.
 *
 * Example:
 *   {gender: ['female'], country_id: 'NG', min_age: 20, max_age: 45}
 *   Always produces: "country_id:NG|gender:female|max_age:45|min_age:20"
 */
export function normalizeSearchFilters(filters: SearchFilters): string {
  const canonical = {
    age_group: filters.age_group?.trim().toLowerCase() ?? null,
    country_id: filters.country_id?.trim().toUpperCase() ?? null,
    gender:
      filters.gender !== undefined && filters.gender.length > 0
        ? [...filters.gender].map(normalizeGenderValue).sort()
        : null,
    max_age: filters.max_age ?? null,
    min_age: filters.min_age ?? null,
  } satisfies Record<string, CanonicalFilterValue>;

  return stableSerialize(canonical);
}

export function normalizeProfileFilterQuery(
  filters: ProfileQueryInput,
): string {
  const canonical = {
    age_group: filters.age_group?.trim().toLowerCase() ?? null,
    country_id: filters.country_id?.trim().toUpperCase() ?? null,
    gender: filters.gender ? normalizeGenderValue(filters.gender) : null,
    limit: Math.max(filters.limit ?? 1, 1),
    max_age: filters.max_age ?? null,
    min_age: filters.min_age ?? null,
    min_country_probability: filters.min_country_probability ?? null,
    min_gender_probability: filters.min_gender_probability ?? null,
    order: filters.order,
    page: Math.max(filters.page ?? 1, 1),
    sort_by: filters.sort_by,
  } satisfies Record<string, CanonicalFilterValue>;

  return stableSerialize(canonical);
}

export function normalizeProfileCountFilterQuery(
  filters: ProfileQueryInput,
): string {
  const canonical = {
    age_group: filters.age_group?.trim().toLowerCase() ?? null,
    country_id: filters.country_id?.trim().toUpperCase() ?? null,
    gender: filters.gender ? normalizeGenderValue(filters.gender) : null,
    max_age: filters.max_age ?? null,
    min_age: filters.min_age ?? null,
    min_country_probability: filters.min_country_probability ?? null,
    min_gender_probability: filters.min_gender_probability ?? null,
    sort_by: filters.sort_by,
    order: filters.order,
  } satisfies Record<string, CanonicalFilterValue>;

  return stableSerialize(canonical);
}

/**
 * Generate a cache key from normalized filters and pagination.
 * @example
 *   getSearchCacheKey({country_id: 'NG', gender: ['female']}, 1)
 *   // -> "profiles:search:country_id:NG|gender:female:1"
 */
export function getSearchCacheKey(
  filters: SearchFilters,
  page: number,
): string {
  const normalized = normalizeSearchFilters(filters);
  return `profiles:search:${normalized}:${page}`;
}

export function getProfileListCacheKey(filters: ProfileQueryInput): string {
  return `profiles:list:${normalizeProfileFilterQuery(filters)}`;
}

export function getProfileCountCacheKey(filters: ProfileQueryInput): string {
  return `profiles:count:${normalizeProfileCountFilterQuery(filters)}`;
}
