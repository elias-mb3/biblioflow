import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = './data/test.db';

process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.MAX_RENTALS_PER_USER = '3';

beforeAll(() => {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
  });
});

afterAll(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  if (existsSync(`${TEST_DB}-journal`)) unlinkSync(`${TEST_DB}-journal`);
});
