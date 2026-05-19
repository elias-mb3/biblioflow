import { prisma } from '../config/database';
import { CreateBookInput, UpdateBookInput } from '../schemas/book';

const PAGE_SIZE = 10;

export const bookRepository = {
  findById(id: string) {
    return prisma.book.findUnique({ where: { id } });
  },

  findByRegistrationCode(code: string) {
    return prisma.book.findUnique({ where: { registrationCode: code } });
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
    const where = q
      ? field === 'title'
        ? { title: { contains: q } }
        : field === 'author'
          ? { author: { contains: q } }
          : field === 'registrationCode'
            ? { registrationCode: { contains: q } }
            : {
                OR: [
                  { title: { contains: q } },
                  { author: { contains: q } },
                  { registrationCode: { contains: q } },
                ],
              }
      : {};

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

  create(data: CreateBookInput & { registrationCode: string }) {
    return prisma.book.create({ data });
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
