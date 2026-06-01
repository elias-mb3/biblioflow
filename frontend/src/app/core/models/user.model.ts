export type Role = 'MANAGER' | 'USER';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  email?: string;
  cpf?: string;
  createdAt: string;
}

export interface AuthPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  phone: string;
  role: Role;
  password: string;
  email?: string;
  cpf?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
