import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/user.repository';
import { RegisterInput, LoginInput } from '../schemas/auth';
import { AppError } from '../utils/errors';
import { env } from '../config/env';
import { Role } from '../generated/prisma/client';

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

/**
 * Gate de criação de gestor: permitido apenas no bootstrap (nenhum MANAGER
 * existe ainda e o bootstrap público está habilitado) ou quando a requisição
 * é feita por um gestor autenticado.
 */
async function assertCanRegisterManager(requesterRole?: Role) {
  if (requesterRole === 'MANAGER') return;

  const managerCount = await userRepository.countByRole('MANAGER');
  const canBootstrap = managerCount === 0 && env.ALLOW_PUBLIC_MANAGER_BOOTSTRAP;
  if (!canBootstrap) {
    throw new AppError(
      'Cadastro de gestor não permitido. Faça login como gestor para criar novos gestores.',
      403,
    );
  }
}

export interface RegisterContext {
  requesterRole?: Role;
}

export const authService = {
  async register(input: RegisterInput, context: RegisterContext = {}) {
    if (input.role === 'MANAGER') {
      await assertCanRegisterManager(context.requesterRole);
    }

    if (input.role === 'USER' && input.cpf) {
      const existing = await userRepository.findByCpf(input.cpf);
      if (existing) throw new AppError('CPF já cadastrado', 409);
    }

    if (input.role === 'MANAGER' && input.email) {
      const existing = await userRepository.findByEmail(input.email);
      if (existing) throw new AppError('E-mail já cadastrado', 409);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      role: input.role as Role,
      fullName: input.fullName,
      phone: input.phone,
      cpf: input.cpf,
      email: input.email,
      passwordHash,
    });

    return { id: user.id, role: user.role, fullName: user.fullName };
  },

  async login(input: LoginInput) {
    const user = input.identifier.includes('@')
      ? await userRepository.findByEmail(input.identifier)
      : await userRepository.findByCpf(input.identifier);

    if (!user) throw new AppError('Credenciais inválidas', 401);

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new AppError('Credenciais inválidas', 401);

    const token = jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });

    return { token, user: { id: user.id, role: user.role, fullName: user.fullName } };
  },
};
