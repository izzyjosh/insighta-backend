import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { BadRequestError } from './api.errors';

countries.registerLocale(enLocale);

const GENDER_MAP: Record<string, 'male' | 'female'> = {
  male: 'male',
  males: 'male',
  man: 'male',
  men: 'male',

  female: 'female',
  females: 'female',
  woman: 'female',
  women: 'female',
};

const AGE_GROUP_MAP: Record<string, string> = {
  child: 'child',
  children: 'child',

  teenager: 'teenager',
  teen: 'teenager',
  teens: 'teenager',

  adult: 'adult',
  adults: 'adult',

  senior: 'senior',
  seniors: 'senior',
};

const COUNTRY_MAP: Record<string, string> = Object.entries(
  countries.getNames('en'),
).reduce<Record<string, string>>((acc, [code, name]) => {
  acc[name.toLowerCase()] = code;
  return acc;
}, {});

const COUNTRY_ENTRIES = Object.entries(COUNTRY_MAP).sort(
  ([countryA], [countryB]) => countryB.length - countryA.length,
);

type AgeRuleResult = {
  min?: number | undefined;
  max?: number | undefined;
};

type AgeRule =
  | { pattern: RegExp; min: number; max: number }
  | { pattern: RegExp; handler: (...nums: number[]) => AgeRuleResult };

const AGE_RULES: AgeRule[] = [
  { pattern: /young/, min: 16, max: 24 },
  { pattern: /teen/, min: 13, max: 19 },
  {
    pattern: /(?:age\s+)?(\d+)\s*(?:to|-|through)\s*(\d+)/,
    handler: (...[min, max]) => ({ min, max }),
  },
  {
    pattern: /above (\d+)/,
    handler: (...[n]) => ({ min: n ? n + 1 : undefined }),
  },
  { pattern: /under (\d+)/, handler: (...[n]) => ({ max: n ? n : undefined }) },
  {
    pattern: /between (\d+) and (\d+)/,
    handler: (...[a, b]) => ({ min: a, max: b }),
  },
];

export type SearchFilters = {
  gender?: ('male' | 'female')[];
  min_age?: number;
  max_age?: number;
  age_group?: string;
  country_id?: string;
};

export function parseNaturalQuery(query: string): SearchFilters {
  const result: SearchFilters = {};

  // Normalize input
  const q = query.toLowerCase().trim();

  // Tokenize safely (remove punctuation too)
  const tokens = q.replace(/[^\w\s]/g, '').split(/\s+/);

  // -------------------
  // 1. Gender detection (EXACT match)
  // -------------------
  const genders: ('male' | 'female')[] = [];

  for (const token of tokens) {
    if (GENDER_MAP[token]) {
      const gender = GENDER_MAP[token];

      if (!genders.includes(gender)) {
        genders.push(gender);
      }
    }
  }

  if (genders.length > 0) {
    result.gender = genders;
  }

  // -------------------
  // 2. Age group detection (EXACT match)
  // -------------------
  for (const token of tokens) {
    if (AGE_GROUP_MAP[token]) {
      result.age_group = AGE_GROUP_MAP[token];
      break;
    }
  }

  // -------------------
  // 3. Age rules (use full string)
  // -------------------
  for (const rule of AGE_RULES) {
    const match = q.match(rule.pattern);

    if (!match) continue;

    if ('handler' in rule) {
      const nums = match.slice(1).map(Number);
      const res = rule.handler(...nums);

      if (res.min !== undefined) result.min_age = res.min;
      if (res.max !== undefined) result.max_age = res.max;
      continue;
    }

    result.min_age = rule.min;
    result.max_age = rule.max;
  }

  // -------------------
  // 4. Country detection (PHRASE match)
  // -------------------
  for (const [country, countryId] of COUNTRY_ENTRIES) {
    // match full phrase inside query
    if (q.includes(country)) {
      result.country_id = countryId;
      break;
    }
  }

  // -------------------
  // 5. Validation
  // -------------------
  if (Object.keys(result).length === 0) {
    throw new BadRequestError('Unable to interpret query');
  }

  return result;
}
