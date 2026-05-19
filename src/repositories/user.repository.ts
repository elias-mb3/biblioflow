import { prisma } from '../config/database';
import { Role } from '../generated/prisma/client';

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

  create(data: CreateUserData) {
    return prisma.user.create({ data });
  },

  countActiveRentals(userId: string) {
    return prisma.rental.count({ where: { userId, status: 'ACTIVE' } });
  },
};
