import 'dotenv/config';

export const env = {
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '1d',
  MAX_RENTALS_PER_USER: parseInt(process.env.MAX_RENTALS_PER_USER ?? '3', 10),
};
