import { z } from 'zod';

const VALID_PERIODS = [15, 30, 45] as const;

export const createRentalSchema = z.object({
  bookId: z.string().uuid(),
  userId: z.string().uuid(),
  periodDays: z
    .number()
    .refine((v): v is 15 | 30 | 45 => (VALID_PERIODS as readonly number[]).includes(v), {
      message: 'Período deve ser 15, 30 ou 45 dias',
    }),
});

export const listRentalsSchema = z.object({
  status: z.enum(['ACTIVE', 'FINALIZED']).optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type CreateRentalInput = z.infer<typeof createRentalSchema>;
