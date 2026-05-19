import { z } from 'zod';

export const createDonationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1),
  author: z.string().min(1),
});

export type CreateDonationInput = z.infer<typeof createDonationSchema>;
