import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(8),
  cpf: z.string().min(1),
  password: z.string().min(6),
});

export const userSearchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UserSearchInput = z.infer<typeof userSearchSchema>;
