import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { createManagerAndLogin, seedBook } from './helpers';

let managerToken: string;
let userId: string;

beforeEach(async () => {
  await prisma.rental.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();

  managerToken = await createManagerAndLogin();

  const userRes = await request(app).post('/api/v1/auth/register').send({
    role: 'USER',
    fullName: 'Leitor Teste',
    phone: '11777777777',
    cpf: '55566677788',
    password: 'secret123',
  });
  userId = userRes.body.id;
});

describe('POST /api/v1/rentals', () => {
  it('creates a rental with valid period', async () => {
    const book = await seedBook(2);
    const res = await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: book.id, userId, periodDays: 15 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.late).toBe(false);
  });

  it('rejects invalid periodDays', async () => {
    const book = await seedBook(2);
    const res = await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: book.id, userId, periodDays: 20 });
    expect(res.status).toBe(400);
  });

  it('rejects when no copies available', async () => {
    const book = await seedBook(1);
    await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: book.id, userId, periodDays: 15 });

    const res = await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: book.id, userId, periodDays: 15 });
    expect(res.status).toBe(409);
  });

  it('rejects when user exceeds max simultaneous rentals', async () => {
    const books = await Promise.all([seedBook(), seedBook(), seedBook(), seedBook()]);

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/rentals')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ bookId: books[i].id, userId, periodDays: 30 });
    }

    const res = await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: books[3].id, userId, periodDays: 30 });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/v1/rentals/:id/finalize', () => {
  it('finalizes a rental', async () => {
    const book = await seedBook(2);
    const created = await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: book.id, userId, periodDays: 30 });

    const res = await request(app)
      .patch(`/api/v1/rentals/${created.body.id}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FINALIZED');
    expect(res.body).toHaveProperty('returnDate');
  });

  it('returns 409 when finalizing an already finalized rental', async () => {
    const book = await seedBook(2);
    const created = await request(app)
      .post('/api/v1/rentals')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ bookId: book.id, userId, periodDays: 30 });

    await request(app)
      .patch(`/api/v1/rentals/${created.body.id}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`);

    const res = await request(app)
      .patch(`/api/v1/rentals/${created.body.id}/finalize`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/rentals/pending', () => {
  it('lists overdue rentals', async () => {
    const book = await seedBook(2);
    const rental = await prisma.rental.create({
      data: {
        bookId: book.id,
        userId,
        periodDays: 15,
        startDate: new Date('2025-01-01'),
        dueDate: new Date('2025-01-16'),
        status: 'ACTIVE',
      },
    });

    const res = await request(app)
      .get('/api/v1/rentals/pending')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some((r: { id: string }) => r.id === rental.id)).toBe(true);
  });
});
