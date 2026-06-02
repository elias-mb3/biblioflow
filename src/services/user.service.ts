import { userRepository } from '../repositories/user.repository';
import { CreateUserInput } from '../schemas/user';
import { AppError } from '../utils/errors';
import { hashPassword } from './auth.service';
import { User } from '../generated/prisma/client';

type PublicUser = Omit<User, 'passwordHash'>;

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const userService = {
  async list(params: { q?: string; page: number }) {
    const result = await userRepository.findMany(params);
    return { ...result, items: result.items.map(toPublicUser) };
  },

  async getById(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('Usuário não encontrado', 404);
    return toPublicUser(user);
  },

  async create(input: CreateUserInput) {
    const existing = await userRepository.findByCpf(input.cpf);
    if (existing) throw new AppError('CPF já cadastrado', 409);

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      role: 'USER',
      fullName: input.fullName,
      phone: input.phone,
      cpf: input.cpf,
      passwordHash,
    });

    return toPublicUser(user);
  },
};
