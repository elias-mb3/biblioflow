import { prisma } from '../config/database';
import { CreateDonationInput } from '../schemas/donation';

export const donationRepository = {
  create(data: CreateDonationInput) {
    return prisma.donation.create({ data });
  },
};
