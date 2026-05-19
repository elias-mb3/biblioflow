import { Request } from 'express';
import { Role } from '../generated/prisma/client';

export interface AuthPayload {
  sub: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}
