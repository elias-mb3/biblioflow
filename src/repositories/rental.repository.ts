import { prisma } from '../config/database';
import { RentalStatus } from '../generated/prisma/client';

const PAGE_SIZE = 10;

export interface CreateRentalData {
  bookId: string;
  userId: string;
  periodDays: number;
  startDate: Date;
  dueDate: Date;
}

export const rentalRepository = {
  findById(id: string) {
    return prisma.rental.findUnique({
      where: { id },
      include: {
        book: true,
        user: { select: { id: true, fullName: true, phone: true, cpf: true } },
      },
    });
  },

  async list(params: { status?: RentalStatus; page: number }) {
    const { status, page } = params;
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      prisma.rental.findMany({
        where,
        include: {
          book: { select: { id: true, title: true, registrationCode: true } },
          user: { select: { id: true, fullName: true } },
        },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.rental.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / PAGE_SIZE) };
  },

  async listPending(page: number) {
    const now = new Date();
    const where = { status: RentalStatus.ACTIVE, dueDate: { lt: now } };
    const [items, total] = await Promise.all([
      prisma.rental.findMany({
        where,
        include: {
          book: { select: { id: true, title: true } },
          user: { select: { id: true, fullName: true, phone: true } },
        },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { dueDate: 'asc' },
      }),
      prisma.rental.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / PAGE_SIZE) };
  },

  countActive(bookId: string) {
    return prisma.rental.count({ where: { bookId, status: 'ACTIVE' } });
  },

  countUserActive(userId: string) {
    return prisma.rental.count({ where: { userId, status: 'ACTIVE' } });
  },

  create(data: CreateRentalData) {
    return prisma.rental.create({ data });
  },

  finalize(id: string, returnDate: Date, late: boolean) {
    return prisma.rental.update({
      where: { id },
      data: { status: 'FINALIZED', returnDate, late },
    });
  },
};
