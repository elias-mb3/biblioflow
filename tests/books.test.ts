import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { createManagerAndLogin, createUserAndLogin } from './helpers';

let managerToken: string;
let userToken: string;

beforeEach(async () => {
  await prisma.rental.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
  managerToken = await createManagerAndLogin();
  userToken = await createUserAndLogin();
});

describe('POST /api/v1/books', () => {
  it('manager creates a book', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Dom Quixote', description: 'Classic', author: 'Cervantes', quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('registrationCode');
    expect(res.body.registrationCode).not.toBe('');
  });

  it('rejects creation of book if client includes registrationCode', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Book', description: 'Desc', author: 'Author', registrationCode: 'CUSTOM-001' });
    expect(res.status).toBe(201);
    expect(res.body.registrationCode).not.toBe('CUSTOM-001');
  });

  it('forbids USER from creating books', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Book', description: 'Desc', author: 'Author' });
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .send({ title: 'Book', description: 'Desc', author: 'Author' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/books', () => {
  it('returns paginated books', async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        request(app)
          .post('/api/v1/books')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ title: `Book ${i}`, description: 'Desc', author: 'Author' }),
      ),
    );
    const res = await request(app)
      .get('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(10);
    expect(res.body.total).toBe(12);
    expect(res.body.pages).toBe(2);
  });
});

describe('GET /api/v1/books/search', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Dom Quixote', description: 'Classic', author: 'Cervantes' });
  });

  it('searches by title', async () => {
    const res = await request(app)
      .get('/api/v1/books/search?q=Quixote&field=title')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items[0].title).toBe('Dom Quixote');
  });

  it('returns empty when no match', async () => {
    const res = await request(app)
      .get('/api/v1/books/search?q=nonexistent')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});

describe('DELETE /api/v1/books/:id', () => {
  it('deletes a book with no active rentals', async () => {
    const created = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'To Delete', description: 'Desc', author: 'Author' });

    const res = await request(app)
      .delete(`/api/v1/books/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(204);
  });
});
