import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message, detalhes: err.details ?? [] });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      erro: 'Dados inválidos',
      detalhes: err.issues.map((e) => ({ campo: e.path.join('.'), mensagem: e.message })),
    });
    return;
  }

  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
}
