import { SearchFilters } from './natural-query-logic';

/**
 * Normalize SearchFilters into a canonical string for consistent cache keys.
 * Ensures different query phrasings with identical meaning produce the same key.
 *
 * Example:
 *   {gender: ['female'], country_id: 'NG', min_age: 20, max_age: 45}
 *   Always produces: "country_id:NG|gender:female|max_age:45|min_age:20"
 */
export function normalizeSearchFilters(filters: SearchFilters): string {
  const parts: string[] = [];

  // Normalize each field into a sortable key-value pair
  if (filters.age_group !== undefined) {
    parts.push(`age_group:${filters.age_group}`);
  }
  if (filters.country_id !== undefined) {
    parts.push(`country_id:${filters.country_id}`);
  }
  if (filters.gender !== undefined && filters.gender.length > 0) {
    // Sort genders alphabetically for consistency
    parts.push(`gender:${filters.gender.sort().join(',')}`);
  }
  if (filters.max_age !== undefined) {
    parts.push(`max_age:${filters.max_age}`);
  }
  if (filters.min_age !== undefined) {
    parts.push(`min_age:${filters.min_age}`);
  }

  // Sort all parts alphabetically so order of conditions doesn't matter
  return parts.sort().join('|');
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
