import 'dotenv/config';

// Valores de exemplo que NÃO podem ser usados como segredo em produção.
const INSECURE_SECRETS = new Set([
  '',
  'change-me-to-a-random-secret',
  'dev-secret-change-in-production',
]);

// Em dev/test, sem JWT_SECRET definido, usa-se um fallback apenas para não travar o fluxo local.
const DEV_FALLBACK_SECRET = 'dev-secret-change-in-production';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value !== 'false' && value !== '0';
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  JWT_SECRET: process.env.JWT_SECRET ?? DEV_FALLBACK_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1d',
  MAX_RENTALS_PER_USER: parseInt(process.env.MAX_RENTALS_PER_USER ?? '3', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  ALLOW_PUBLIC_MANAGER_BOOTSTRAP: parseBool(process.env.ALLOW_PUBLIC_MANAGER_BOOTSTRAP, true),
  AUTH_RATE_LIMIT_WINDOW_MS: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? '900000', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? '20', 10),

  // Consulta de metadados por ISBN. Nenhuma é obrigatória: a Open Library não
  // exige chave, então a feature funciona sem configuração.
  ISBN_LOOKUP_ENABLED: parseBool(process.env.ISBN_LOOKUP_ENABLED, true),
  ISBN_LOOKUP_TIMEOUT_MS: parseInt(process.env.ISBN_LOOKUP_TIMEOUT_MS ?? '5000', 10),
  ISBN_CACHE_TTL_MS: parseInt(process.env.ISBN_CACHE_TTL_MS ?? '86400000', 10),
  ISBN_NOT_FOUND_CACHE_TTL_MS: parseInt(process.env.ISBN_NOT_FOUND_CACHE_TTL_MS ?? '3600000', 10),
  ISBN_LOOKUP_RATE_LIMIT_MAX: parseInt(process.env.ISBN_LOOKUP_RATE_LIMIT_MAX ?? '30', 10),
  GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY ?? '',
};

/**
 * Valida variáveis críticas antes de subir o servidor. Lança em produção quando
 * o JWT_SECRET está ausente ou igual a um valor de exemplo inseguro.
 * Chamada no bootstrap (server.ts), não no app, para não afetar testes.
 */
export function validateEnv(): void {
  if (env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET ?? '';
    if (INSECURE_SECRETS.has(secret)) {
      throw new Error(
        'JWT_SECRET ausente ou inseguro em produção. Defina um segredo aleatório forte na variável JWT_SECRET.',
      );
    }
  }
}
