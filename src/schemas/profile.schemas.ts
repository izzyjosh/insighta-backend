import { z } from 'zod';

export const createProfileSchema = z.object({
  name: z.string().trim().min(1, 'name cannot be empty'),
  gender: z.string(),
  gender_probability: z.number(),
  age: z.number(),
  age_group: z.string(),
  country_id: z.string(),
  country_name: z.string(),
  country_probability: z.number(),
});

export const profileResponseSchema = createProfileSchema.extend({
  id: z.string(),
  created_at: z.date(),
});

export const listProfileSchema = profileResponseSchema.omit({
  created_at: true,
  gender_probability: true,
  country_probability: true,
});

export type ListProfileDTO = z.infer<typeof listProfileSchema>;
export type CreateProfileDTO = z.infer<typeof createProfileSchema>;
export type ProfileResponseDTO = z.infer<typeof profileResponseSchema>;

export type GenderizeResponse = {
  name: string;
  gender: string | null;
  probability: number;
  count: number;
};

export type AgifyResponse = {
  name: string;
  age: number | null;
  count: number;
};

export type NationalizeCountry = {
  country_id: string;
  probability: number;
};

export type NationalizeResponse = {
  name: string;
  country: NationalizeCountry[];
};

// Query filter schema
export const filterQuerySchema = z.object({
  gender: z.string().optional(),
  age_group: z.string().optional(),
  country_id: z.string().optional(),
  min_age: z.coerce.number().optional(),
  max_age: z.coerce.number().optional(),
  min_gender_probability: z.coerce.number().optional(),
  min_country_probability: z.coerce.number().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(50).default(10),
  sort_by: z
    .enum(['created_at', 'age', 'gender_probability', 'country_probability'])
    .default('created_at'),
  order: z
    .enum(['asc', 'desc'])
    .default('desc')
    .transform((val) => val.toUpperCase() as 'ASC' | 'DESC'),
});

export type FilterQueryDTO = z.infer<typeof filterQuerySchema>;

export const naturalSearchSchema = z.object({
  q: z.string().trim().min(1, 'search query cannot be empty'),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(50).default(10),
});

export type NaturalSearchDTO = z.infer<typeof naturalSearchSchema>;
