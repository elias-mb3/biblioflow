import { z } from 'zod';

export const createBookSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  quantity: z.number().int().positive().default(1),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
});

export const bookSearchSchema = z.object({
  q: z.string().optional(),
  field: z.enum(['title', 'author', 'registrationCode']).optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
