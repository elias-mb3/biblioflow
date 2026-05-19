import { bookRepository } from '../repositories/book.repository';
import { CreateBookInput, UpdateBookInput } from '../schemas/book';
import { AppError } from '../utils/errors';
import { generateRegistrationCode } from '../utils/registrationCode';

export const bookService = {
  async list(page: number) {
    return bookRepository.list(page);
  },

  async search(params: { q?: string; field?: string; page: number }) {
    return bookRepository.search(params);
  },

  async getById(id: string) {
    const book = await bookRepository.findById(id);
    if (!book) throw new AppError('Livro não encontrado', 404);
    return book;
  },

  async create(input: CreateBookInput) {
    const registrationCode = generateRegistrationCode();
    return bookRepository.create({ ...input, registrationCode });
  },

  async update(id: string, input: UpdateBookInput) {
    await this.getById(id);
    return bookRepository.update(id, input);
  },

  async delete(id: string) {
    await this.getById(id);
    const activeRentals = await bookRepository.countActiveRentals(id);
    if (activeRentals > 0) {
      throw new AppError('Não é possível remover um livro com locações ativas', 409);
    }
    return bookRepository.delete(id);
  },
};
