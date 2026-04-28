import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  github_id: z.string(),
  username: z.string(),
  email: z.string().email(),
  avatar_url: z.string().url(),
  role: z.enum(['analyst', 'admin']),
});

export type UserDTO = z.infer<typeof UserSchema>;
