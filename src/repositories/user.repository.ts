import { prisma } from '../config/database';
import { Role } from '../generated/prisma/client';

const PAGE_SIZE = 10;

export interface CreateUserData {
  role: Role;
  fullName: string;
  phone: string;
  cpf?: string;
  email?: string;
  passwordHash: string;
}

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findByCpf(cpf: string) {
    return prisma.user.findUnique({ where: { cpf } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async findMany(params: { q?: string; page: number }) {
    const { q, page } = params;
    const where = q
      ? {
          role: 'USER' as Role,
          OR: [{ fullName: { contains: q } }, { cpf: { contains: q } }],
        }
      : { role: 'USER' as Role };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total, page, pages: Math.ceil(total / PAGE_SIZE) };
  },

  create(data: CreateUserData) {
    return prisma.user.create({ data });
  },

  countActiveRentals(userId: string) {
    return prisma.rental.count({ where: { userId, status: 'ACTIVE' } });
  },
};
