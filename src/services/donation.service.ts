import { donationRepository } from '../repositories/donation.repository';
import { userRepository } from '../repositories/user.repository';
import { CreateDonationInput } from '../schemas/donation';
import { AppError } from '../utils/errors';

export const donationService = {
  async create(input: CreateDonationInput) {
    const user = await userRepository.findById(input.userId);
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return donationRepository.create(input);
  },
};
