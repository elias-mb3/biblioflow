import { z } from 'zod';

export const registerSchema = z
  .object({
    role: z.enum(['MANAGER', 'USER']),
    fullName: z.string().min(2),
    phone: z.string().min(8),
    cpf: z.string().optional(),
    email: z.string().email().optional(),
    password: z.string().min(6),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'USER' && !data.cpf) {
      ctx.addIssue({
        code: 'custom',
        path: ['cpf'],
        message: 'CPF é obrigatório para perfil USER',
      });
    }
    if (data.role === 'MANAGER' && !data.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['email'],
        message: 'E-mail é obrigatório para perfil MANAGER',
      });
    }
  });

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
