import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { env, validateEnv } from '../src/config/env';
import { createRateLimiter } from '../src/middlewares/rateLimit';

const manager = {
  role: 'MANAGER',
  fullName: 'Gestor Bootstrap',
  phone: '11999999999',
  email: 'boot@test.com',
  password: 'secret123',
};

async function registerAndLoginManager() {
  await request(app).post('/api/v1/auth/register').send(manager);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: manager.email, password: manager.password });
  return res.body.token as string;
}

describe('Gate de registro de MANAGER', () => {
  beforeEach(async () => {
    await prisma.rental.deleteMany();
    await prisma.donation.deleteMany();
    await prisma.user.deleteMany();
  });

  it('permite o 1º gestor publicamente (bootstrap)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(manager);
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MANAGER');
  });

  it('bloqueia o 2º gestor sem autenticação (403)', async () => {
    await request(app).post('/api/v1/auth/register').send(manager);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...manager, email: 'segundo@test.com' });
    expect(res.status).toBe(403);
  });

  it('permite um gestor autenticado criar outro gestor', async () => {
    const token = await registerAndLoginManager();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...manager, email: 'segundo@test.com' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MANAGER');
  });

  it('proíbe um USER autenticado de criar gestor (403)', async () => {
    await request(app).post('/api/v1/auth/register').send(manager);
    await request(app).post('/api/v1/auth/register').send({
      role: 'USER',
      fullName: 'Leitor',
      phone: '11888888888',
      cpf: '12312312300',
      password: 'secret123',
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '12312312300', password: 'secret123' });
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ ...manager, email: 'terceiro@test.com' });
    expect(res.status).toBe(403);
  });

  it('mantém o registro público de USER aberto', async () => {
    await request(app).post('/api/v1/auth/register').send(manager);
    const res = await request(app).post('/api/v1/auth/register').send({
      role: 'USER',
      fullName: 'Leitor',
      phone: '11888888888',
      cpf: '45645645600',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('USER');
  });

  it('respeita ALLOW_PUBLIC_MANAGER_BOOTSTRAP=false (403 mesmo sem gestores)', async () => {
    const original = env.ALLOW_PUBLIC_MANAGER_BOOTSTRAP;
    env.ALLOW_PUBLIC_MANAGER_BOOTSTRAP = false;
    try {
      const res = await request(app).post('/api/v1/auth/register').send(manager);
      expect(res.status).toBe(403);
    } finally {
      env.ALLOW_PUBLIC_MANAGER_BOOTSTRAP = original;
    }
  });
});

describe('validateEnv', () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalSecret;
  });

  it('lança em produção quando o JWT_SECRET é um valor de exemplo', () => {
    env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'change-me-to-a-random-secret';
    expect(() => validateEnv()).toThrow(/JWT_SECRET/);
  });

  it('lança em produção quando o JWT_SECRET está ausente', () => {
    env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => validateEnv()).toThrow(/JWT_SECRET/);
  });

  it('não lança em produção com um segredo forte', () => {
    env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'um-segredo-bem-aleatorio-e-forte-1234567890';
    expect(() => validateEnv()).not.toThrow();
  });

  it('não lança fora de produção mesmo com segredo de exemplo', () => {
    env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'change-me-to-a-random-secret';
    expect(() => validateEnv()).not.toThrow();
  });
});

describe('Rate limiter', () => {
  it('retorna 429 após exceder o limite configurado', async () => {
    const limited = express();
    limited.use(createRateLimiter({ windowMs: 60_000, limit: 2 }));
    limited.get('/ping', (_req, res) => {
      res.json({ ok: true });
    });

    await request(limited).get('/ping').expect(200);
    await request(limited).get('/ping').expect(200);
    const res = await request(limited).get('/ping');
    expect(res.status).toBe(429);
    expect(res.body.erro).toMatch(/tentativas/i);
  });
});
