import { prisma } from '../config/database';
import { CreateBookInput, UpdateBookInput } from '../schemas/book';

const PAGE_SIZE = 10;

/** Campos vindos do provedor de ISBN não estão em `CreateBookInput` (não vêm do cliente). */
type CreateBookData = CreateBookInput & {
  registrationCode: string;
  coverUrl?: string;
  publisher?: string;
  publishedYear?: number;
};

export const bookRepository = {
  findById(id: string) {
    return prisma.book.findUnique({ where: { id } });
  },

  findByRegistrationCode(code: string) {
    return prisma.book.findUnique({ where: { registrationCode: code } });
  },

  findByIsbn(isbn: string) {
    return prisma.book.findUnique({ where: { isbn } });
  },

  async list(page: number) {
    const [items, total] = await Promise.all([
      prisma.book.findMany({
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.book.count(),
    ]);
    return { items, total, page, pages: Math.ceil(total / PAGE_SIZE) };
  },

  async search(params: { q?: string; field?: string; page: number }) {
    const { q, field, page } = params;

    const SEARCHABLE_FIELDS = ['title', 'author', 'registrationCode', 'isbn'] as const;
    const target = SEARCHABLE_FIELDS.find((name) => name === field);

    const where = !q
      ? {}
      : target
        ? { [target]: { contains: q } }
        : { OR: SEARCHABLE_FIELDS.map((name) => ({ [name]: { contains: q } })) };

    const [items, total] = await Promise.all([
      prisma.book.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.book.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / PAGE_SIZE) };
  },

  create(data: CreateBookData) {
    return prisma.book.create({ data });
  },

  incrementQuantity(id: string, by: number) {
    return prisma.book.update({ where: { id }, data: { quantity: { increment: by } } });
  },

  update(id: string, data: UpdateBookInput) {
    return prisma.book.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.book.delete({ where: { id } });
  },

  countActiveRentals(bookId: string) {
    return prisma.rental.count({ where: { bookId, status: 'ACTIVE' } });
  },
};
