import { bookRepository } from '../repositories/book.repository';
import { CreateBookFromIsbnInput, CreateBookInput, UpdateBookInput } from '../schemas/book';
import { IsbnPreview } from '../types/isbn';
import { AppError } from '../utils/errors';
import { normalizeIsbn } from '../utils/isbn';
import { generateRegistrationCode } from '../utils/registrationCode';
import { isbnLookupService } from './isbnLookup.service';

/**
 * Normaliza o ISBN para ISBN-13 (ADR 0002) e garante que ele não colide com
 * outro registro. `ignoreBookId` permite que um update reenvie o próprio ISBN.
 */
async function normalizeAndEnsureUnique(
  isbn: string | undefined,
  ignoreBookId?: string,
): Promise<string | undefined> {
  if (isbn === undefined) return undefined;

  const normalized = normalizeIsbn(isbn);
  if (!normalized) throw new AppError('ISBN inválido', 400);

  const existing = await bookRepository.findByIsbn(normalized);
  if (existing && existing.id !== ignoreBookId) {
    throw new AppError('Já existe um livro cadastrado com este ISBN', 409);
  }
  return normalized;
}

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
    const isbn = await normalizeAndEnsureUnique(input.isbn);
    const registrationCode = generateRegistrationCode();
    return bookRepository.create({ ...input, isbn, registrationCode });
  },

  async update(id: string, input: UpdateBookInput) {
    await this.getById(id);
    const isbn = await normalizeAndEnsureUnique(input.isbn, id);
    return bookRepository.update(id, { ...input, ...(isbn !== undefined && { isbn }) });
  },

  async delete(id: string) {
    await this.getById(id);
    const activeRentals = await bookRepository.countActiveRentals(id);
    if (activeRentals > 0) {
      throw new AppError('Não é possível remover um livro com locações ativas', 409);
    }
    return bookRepository.delete(id);
  },

  /** Consulta os metadados sem persistir, sinalizando se o ISBN já está no acervo. */
  async previewByIsbn(rawIsbn: string): Promise<IsbnPreview> {
    const metadata = await isbnLookupService.lookup(rawIsbn);
    const existing = await bookRepository.findByIsbn(metadata.isbn);

    return {
      ...metadata,
      alreadyRegistered: existing !== null,
      ...(existing && { existingBookId: existing.id }),
    };
  },

  /**
   * Cadastra a partir do ISBN. Se o livro já existe no acervo, soma ao estoque
   * em vez de falhar — ver ADR 0003.
   */
  async createFromIsbn({ isbn, quantity }: CreateBookFromIsbnInput) {
    const metadata = await isbnLookupService.lookup(isbn);
    const existing = await bookRepository.findByIsbn(metadata.isbn);

    if (existing) {
      const book = await bookRepository.incrementQuantity(existing.id, quantity);
      return { ...book, incremented: true };
    }

    const book = await bookRepository.create({
      registrationCode: generateRegistrationCode(),
      title: metadata.title,
      description: metadata.description,
      author: metadata.author,
      quantity,
      isbn: metadata.isbn,
      coverUrl: metadata.coverUrl,
      publisher: metadata.publisher,
      publishedYear: metadata.publishedYear,
    });
    return { ...book, incremented: false };
  },
};
