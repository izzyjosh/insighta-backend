const test = require('node:test');
const assert = require('node:assert/strict');
const jiti = require('jiti')(__filename);

const { parseNaturalQuery } = jiti('../src/utils/natural-query-logic.ts');
const {
  getSearchCacheKey,
  normalizeSearchFilters,
  normalizeProfileCountFilterQuery,
  getProfileCountCacheKey,
} = jiti('../src/utils/normalize-search-filters.ts');

test('parseNaturalQuery extracts gender, country, and age range', () => {
  const result = parseNaturalQuery('women in nigeria age 20 to 45');

  assert.deepEqual(result, {
    gender: ['female'],
    country_id: 'NG',
    min_age: 20,
    max_age: 45,
  });
});

test('equivalent natural queries normalize to the same cache key', () => {
  const first = parseNaturalQuery('women in nigeria age 20 to 45');
  const second = parseNaturalQuery(
    'female users from Nigeria between 20 and 45',
  );

  assert.deepEqual(first, second);
  assert.equal(getSearchCacheKey(first, 1), getSearchCacheKey(second, 1));
});

test('normalizeSearchFilters keeps gender canonical and stable', () => {
  const first = normalizeSearchFilters({
    gender: ['female'],
    country_id: 'ng',
    min_age: 20,
    max_age: 45,
  });

  const second = normalizeSearchFilters({
    gender: ['female'],
    country_id: 'NG',
    max_age: 45,
    min_age: 20,
  });

  assert.equal(first, second);
});

test('count cache ignores pagination while list cache includes it', () => {
  const base = {
    gender: ['female'],
    country_id: 'NG',
    min_age: 20,
    max_age: 45,
    min_country_probability: 0.5,
    min_gender_probability: 0.6,
    age_group: undefined,
    limit: 10,
    page: 1,
    sort_by: 'created_at',
    order: 'DESC',
  };

  const pageTwo = { ...base, page: 2 };

  assert.notEqual(normalizeProfileCountFilterQuery(base), undefined);
  assert.equal(getProfileCountCacheKey(base), getProfileCountCacheKey(pageTwo));
  assert.notEqual(
    getSearchCacheKey(
      { gender: ['female'], country_id: 'NG', min_age: 20, max_age: 45 },
      1,
    ),
    getSearchCacheKey(
      { gender: ['female'], country_id: 'NG', min_age: 20, max_age: 45 },
      2,
    ),
  );
});
