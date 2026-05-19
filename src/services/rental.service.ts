import { rentalRepository } from '../repositories/rental.repository';
import { bookRepository } from '../repositories/book.repository';
import { userRepository } from '../repositories/user.repository';
import { CreateRentalInput } from '../schemas/rental';
import { AppError } from '../utils/errors';
import { env } from '../config/env';
import { RentalStatus } from '../generated/prisma/client';

export const rentalService = {
  async list(params: { status?: RentalStatus; page: number }) {
    return rentalRepository.list(params);
  },

  async getById(id: string) {
    const rental = await rentalRepository.findById(id);
    if (!rental) throw new AppError('Locação não encontrada', 404);
    return rental;
  },

  async listPending(page: number) {
    return rentalRepository.listPending(page);
  },

  async create(input: CreateRentalInput) {
    const book = await bookRepository.findById(input.bookId);
    if (!book) throw new AppError('Livro não encontrado', 404);

    const user = await userRepository.findById(input.userId);
    if (!user) throw new AppError('Usuário não encontrado', 404);

    const activeForBook = await rentalRepository.countActive(input.bookId);
    if (activeForBook >= book.quantity) {
      throw new AppError('Não há exemplares disponíveis para locação', 409);
    }

    const activeForUser = await rentalRepository.countUserActive(input.userId);
    if (activeForUser >= env.MAX_RENTALS_PER_USER) {
      throw new AppError(
        `Usuário atingiu o limite de ${env.MAX_RENTALS_PER_USER} locações simultâneas`,
        409,
      );
    }

    const startDate = new Date();
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + input.periodDays);

    return rentalRepository.create({ ...input, startDate, dueDate });
  },

  async finalize(id: string) {
    const rental = await this.getById(id);

    if (rental.status === 'FINALIZED') {
      throw new AppError('Locação já foi finalizada', 409);
    }

    const returnDate = new Date();
    const late = returnDate > rental.dueDate;

    return rentalRepository.finalize(id, returnDate, late);
  },
};
