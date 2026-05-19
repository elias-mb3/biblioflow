import { randomBytes } from 'crypto';

export function generateRegistrationCode(): string {
  const prefix = 'BIB';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
