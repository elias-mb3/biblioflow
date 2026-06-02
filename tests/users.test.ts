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
  // cria um USER de apoio (CPF 99988877766) e devolve seu token
  userToken = await createUserAndLogin();
});

describe('POST /api/v1/users', () => {
  it('manager cadastra um leitor sem retornar passwordHash nem token', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        fullName: 'Ana Lima',
        phone: '11987654321',
        cpf: '12345678901',
        password: 'secret123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'USER', fullName: 'Ana Lima', cpf: '12345678901' });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('token');
  });

  it('retorna 409 ao cadastrar CPF duplicado', async () => {
    const body = {
      fullName: 'Bruno Souza',
      phone: '11955554444',
      cpf: '55544433322',
      password: 'secret123',
    };
    await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(body);
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(body);
    expect(res.status).toBe(409);
  });

  it('rejeita cadastro sem CPF', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ fullName: 'Sem CPF', phone: '11955554444', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('proíbe USER de cadastrar leitores (403)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ fullName: 'Ana', phone: '11987654321', cpf: '12345678901', password: 'secret123' });
    expect(res.status).toBe(403);
  });

  it('exige autenticação (401 sem token)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .send({ fullName: 'Ana', phone: '11987654321', cpf: '12345678901', password: 'secret123' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/users', () => {
  it('lista leitores de forma paginada', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('pages');
    // o USER de apoio criado no beforeEach deve estar presente
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items.every((u: { role: string }) => u.role === 'USER')).toBe(true);
    expect(res.body.items[0]).not.toHaveProperty('passwordHash');
  });

  it('busca por nome via q', async () => {
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${managerToken}`).send({
      fullName: 'Carlos Drummond',
      phone: '11900001111',
      cpf: '11122233300',
      password: 'secret123',
    });

    const res = await request(app)
      .get('/api/v1/users')
      .query({ q: 'Drummond' })
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].fullName).toBe('Carlos Drummond');
  });

  it('busca por CPF via q', async () => {
    await request(app).post('/api/v1/users').set('Authorization', `Bearer ${managerToken}`).send({
      fullName: 'Maria Clara',
      phone: '11900002222',
      cpf: '78978978900',
      password: 'secret123',
    });

    const res = await request(app)
      .get('/api/v1/users')
      .query({ q: '78978978900' })
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].cpf).toBe('78978978900');
  });

  it('proíbe USER de listar (403)', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('exige autenticação (401 sem token)', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/users/:id', () => {
  it('retorna detalhe de um leitor existente', async () => {
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        fullName: 'Júlia Reis',
        phone: '11933334444',
        cpf: '32132132100',
        password: 'secret123',
      });

    const res = await request(app)
      .get(`/api/v1/users/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, fullName: 'Júlia Reis' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('retorna 404 para id inexistente', async () => {
    const res = await request(app)
      .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(404);
  });

  it('proíbe USER de ver detalhe (403)', async () => {
    const res = await request(app)
      .get('/api/v1/users/qualquer-id')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});
