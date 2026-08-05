import rateLimit, { Options } from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Fábrica de rate limiters com a resposta de erro padronizada do projeto.
 */
export function createRateLimiter(options: Partial<Options> = {}) {
  return rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
    ...options,
  });
}

/**
 * Rate limiter das rotas de autenticação (proteção contra força bruta).
 * Desativado em ambiente de teste para não interferir nas suítes que
 * exercitam /auth repetidamente.
 */
export const authRateLimiter = createRateLimiter({
  skip: () => env.NODE_ENV === 'test',
});

/**
 * Rate limiter das rotas de consulta por ISBN. São as únicas que fazem I/O de
 * rede para um serviço de terceiro, que pede uso moderado.
 * Desativado em teste pelo mesmo motivo do limiter de autenticação.
 */
export const isbnLookupRateLimiter = createRateLimiter({
  limit: env.ISBN_LOOKUP_RATE_LIMIT_MAX,
  skip: () => env.NODE_ENV === 'test',
});
