import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { isbnLookupService } from '../src/services/isbnLookup.service';
import { createManagerAndLogin, createUserAndLogin } from './helpers';

const ISBN = '9788535902778';
const ISBN_HYPHENATED = '978-85-359-0277-8';

const editionResponse = {
  [`ISBN:${ISBN}`]: {
    title: 'A ditadura envergonhada',
    authors: [{ name: 'Elio Gaspari' }],
    publishers: [{ name: 'Companhia das Letras' }],
    publish_date: '2002',
    number_of_pages: 417,
    cover: { large: 'https://covers.openlibrary.org/b/id/1-L.jpg' },
  },
};

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

/** Provedor respondendo o caminho feliz: edição → work key → descrição. */
function stubProviderFound() {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(editionResponse))
      .mockResolvedValueOnce(jsonResponse({ docs: [{ key: '/works/OL1W' }] }))
      .mockResolvedValueOnce(jsonResponse({ description: 'Sobre a ditadura militar.' })),
  );
}

function stubProviderNotFound() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
}

function stubProviderDown() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')));
}

let managerToken: string;
let userToken: string;

beforeEach(async () => {
  await prisma.rental.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
  isbnLookupService.clearCache();
  managerToken = await createManagerAndLogin();
  userToken = await createUserAndLogin();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /api/v1/books/isbn/:isbn', () => {
  it('retorna os metadados do livro', async () => {
    stubProviderFound();

    const res = await request(app)
      .get(`/api/v1/books/isbn/${ISBN}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isbn: ISBN,
      title: 'A ditadura envergonhada',
      author: 'Elio Gaspari',
      publisher: 'Companhia das Letras',
      publishedYear: 2002,
      source: 'openlibrary',
      alreadyRegistered: false,
    });
  });

  it('normaliza um ISBN com hífens', async () => {
    stubProviderFound();

    const res = await request(app)
      .get(`/api/v1/books/isbn/${ISBN_HYPHENATED}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isbn).toBe(ISBN);
  });

  it('sinaliza quando o ISBN já está no acervo', async () => {
    stubProviderFound();
    const created = await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN });

    isbnLookupService.clearCache();
    stubProviderFound();
    const res = await request(app)
      .get(`/api/v1/books/isbn/${ISBN}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.alreadyRegistered).toBe(true);
    expect(res.body.existingBookId).toBe(created.body.id);
  });

  it('retorna 400 para ISBN com dígito verificador inválido', async () => {
    stubProviderFound();

    const res = await request(app)
      .get('/api/v1/books/isbn/9788535902779')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('ISBN inválido');
  });

  it('retorna 404 quando o provedor não conhece o ISBN', async () => {
    stubProviderNotFound();

    const res = await request(app)
      .get(`/api/v1/books/isbn/${ISBN}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });

  it('retorna 503 e sugere cadastro manual quando o provedor está fora', async () => {
    stubProviderDown();

    const res = await request(app)
      .get(`/api/v1/books/isbn/${ISBN}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(503);
    expect(res.body.erro).toMatch(/manualmente/i);
  });

  it('retorna 401 sem token e 403 para USER', async () => {
    stubProviderFound();

    const semToken = await request(app).get(`/api/v1/books/isbn/${ISBN}`);
    expect(semToken.status).toBe(401);

    const comoUsuario = await request(app)
      .get(`/api/v1/books/isbn/${ISBN}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(comoUsuario.status).toBe(403);
  });
});

describe('POST /api/v1/books/isbn', () => {
  it('cria o livro com código de registro gerado', async () => {
    stubProviderFound();

    const res = await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'A ditadura envergonhada',
      isbn: ISBN,
      quantity: 2,
      publisher: 'Companhia das Letras',
      publishedYear: 2002,
      coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
      incremented: false,
    });
    expect(res.body.registrationCode).toMatch(/^BIB-/);
  });

  it('usa quantity 1 por padrão', async () => {
    stubProviderFound();

    const res = await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(1);
  });

  it('soma ao estoque quando o ISBN já existe, sem criar outro registro', async () => {
    stubProviderFound();
    await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN, quantity: 2 });

    const res = await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN, quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.incremented).toBe(true);
    expect(res.body.quantity).toBe(5);
    expect(await prisma.book.count()).toBe(1);
  });

  it('retorna 400 para ISBN inválido', async () => {
    stubProviderFound();

    const res = await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: '9788535902779' });

    expect(res.status).toBe(400);
  });

  it('retorna 401 sem token e 403 para USER', async () => {
    stubProviderFound();

    const semToken = await request(app).post('/api/v1/books/isbn').send({ isbn: ISBN });
    expect(semToken.status).toBe(401);

    const comoUsuario = await request(app)
      .post('/api/v1/books/isbn')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isbn: ISBN });
    expect(comoUsuario.status).toBe(403);
  });
});

describe('ISBN no cadastro manual', () => {
  const manualBook = {
    title: 'Dom Casmurro',
    description: 'Bentinho e Capitu.',
    author: 'Machado de Assis',
    isbn: ISBN_HYPHENATED,
  };

  it('grava o ISBN normalizado', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(manualBook);

    expect(res.status).toBe(201);
    expect(res.body.isbn).toBe(ISBN);
  });

  it('retorna 409 quando o ISBN já está cadastrado', async () => {
    await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(manualBook);

    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...manualBook, isbn: ISBN });

    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/já existe/i);
  });

  it('retorna 400 para ISBN com dígito verificador inválido', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...manualBook, isbn: '9788535902779' });

    expect(res.status).toBe(400);
  });

  it('permite criar livro sem ISBN', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Sem ISBN', description: 'Doação antiga', author: 'Anônimo' });

    expect(res.status).toBe(201);
    expect(res.body.isbn).toBeNull();
  });

  it('permite o PUT reenviar o próprio ISBN sem conflito', async () => {
    const created = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(manualBook);

    const res = await request(app)
      .put(`/api/v1/books/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN, quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.quantity).toBe(4);
  });

  it('retorna 409 no PUT quando o ISBN é de outro livro', async () => {
    await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send(manualBook);
    const outro = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Outro', description: 'Outro livro', author: 'Autor' });

    const res = await request(app)
      .put(`/api/v1/books/${outro.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isbn: ISBN });

    expect(res.status).toBe(409);
  });
});

describe('Busca por ISBN', () => {
  it('encontra o livro pelo campo isbn', async () => {
    await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Dom Casmurro', description: 'Clássico', author: 'Machado', isbn: ISBN });

    const res = await request(app)
      .get(`/api/v1/books/search?q=${ISBN}&field=isbn`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].isbn).toBe(ISBN);
  });

  it('encontra pelo ISBN na busca genérica, sem field', async () => {
    await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Dom Casmurro', description: 'Clássico', author: 'Machado', isbn: ISBN });

    const res = await request(app)
      .get(`/api/v1/books/search?q=${ISBN}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});

describe('Regressão de roteamento', () => {
  it('GET /books/:id continua funcionando após as rotas /isbn', async () => {
    const created = await request(app)
      .post('/api/v1/books')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Livro', description: 'Descrição', author: 'Autor' });

    const res = await request(app)
      .get(`/api/v1/books/${created.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it('a rota /books/isbn/:isbn não é capturada por /books/:id', async () => {
    stubProviderFound();

    const res = await request(app)
      .get(`/api/v1/books/isbn/${ISBN}`)
      .set('Authorization', `Bearer ${managerToken}`);

    // Se /:id tivesse capturado, viria 404 "Livro não encontrado".
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('openlibrary');
  });
});
