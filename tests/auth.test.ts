import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';

beforeEach(async () => {
  await prisma.rental.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.user.deleteMany();
});

describe('POST /api/v1/auth/register', () => {
  it('registers a MANAGER with email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      role: 'MANAGER',
      fullName: 'Test Manager',
      phone: '11999999999',
      email: 'manager@test.com',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'MANAGER', fullName: 'Test Manager' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('registers a USER with CPF', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      role: 'USER',
      fullName: 'Test User',
      phone: '11888888888',
      cpf: '11122233344',
      password: 'secret123',
    });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('USER');
  });

  it('rejects MANAGER without email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      role: 'MANAGER',
      fullName: 'No Email',
      phone: '11999999999',
      password: 'secret123',
    });
    expect(res.status).toBe(400);
  });

  it('rejects USER without CPF', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      role: 'USER',
      fullName: 'No CPF',
      phone: '11888888888',
      password: 'secret123',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    const body = {
      role: 'MANAGER',
      fullName: 'Manager',
      phone: '11999999999',
      email: 'dup@test.com',
      password: 'secret123',
    };
    // 1º gestor: bootstrap público
    await request(app).post('/api/v1/auth/register').send(body);
    // login para obter token de gestor (criação de novos gestores exige auth)
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'dup@test.com', password: 'secret123' });
    // tentar recriar com o mesmo e-mail, agora autenticado, deve dar 409
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send(body);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register').send({
      role: 'MANAGER',
      fullName: 'Manager',
      phone: '11999999999',
      email: 'login@test.com',
      password: 'secret123',
    });
  });

  it('returns a JWT on valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'login@test.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'login@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
