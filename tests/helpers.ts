import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { generateRegistrationCode } from '../src/utils/registrationCode';

export async function createManagerAndLogin() {
  await request(app).post('/api/v1/auth/register').send({
    role: 'MANAGER',
    fullName: 'Test Manager',
    phone: '11999999999',
    email: 'testmanager@test.com',
    password: 'secret123',
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: 'testmanager@test.com', password: 'secret123' });
  return res.body.token as string;
}

export async function createUserAndLogin() {
  await request(app).post('/api/v1/auth/register').send({
    role: 'USER',
    fullName: 'Test User',
    phone: '11888888888',
    cpf: '99988877766',
    password: 'secret123',
  });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ identifier: '99988877766', password: 'secret123' });
  return res.body.token as string;
}

export async function seedBook(quantity = 2) {
  return prisma.book.create({
    data: {
      registrationCode: generateRegistrationCode(),
      title: 'Test Book',
      description: 'A test book',
      author: 'Author',
      quantity,
    },
  });
}

export async function seedUser() {
  return prisma.user.findFirst({ where: { role: 'USER' } });
}
