import { z } from 'zod';
import { isValidIsbn } from '../utils/isbn';

const isbnField = z.string().refine(isValidIsbn, { message: 'ISBN inválido' });

export const createBookSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  author: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  isbn: isbnField.optional(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  isbn: isbnField.optional(),
});

export const bookSearchSchema = z.object({
  q: z.string().optional(),
  field: z.enum(['title', 'author', 'registrationCode', 'isbn']).optional(),
  page: z.coerce.number().int().positive().default(1),
});

export const isbnParamSchema = z.object({
  isbn: z.string().min(10),
});

export const createBookFromIsbnSchema = z.object({
  isbn: z.string(),
  quantity: z.number().int().positive().default(1),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type CreateBookFromIsbnInput = z.infer<typeof createBookFromIsbnSchema>;
