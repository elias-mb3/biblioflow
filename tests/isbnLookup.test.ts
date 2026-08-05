import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../src/config/env';
import { isbnLookupService } from '../src/services/isbnLookup.service';

const ISBN = '9788535902778';

const editionResponse = {
  [`ISBN:${ISBN}`]: {
    title: 'A ditadura envergonhada',
    authors: [{ name: 'Elio Gaspari' }],
    publishers: [{ name: 'Companhia das Letras' }],
    publish_date: 'October 1, 1988',
    number_of_pages: 417,
    cover: {
      small: 'https://covers.openlibrary.org/b/id/1-S.jpg',
      medium: 'https://covers.openlibrary.org/b/id/1-M.jpg',
      large: 'https://covers.openlibrary.org/b/id/1-L.jpg',
    },
  },
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

/** Encadeia as 3 chamadas da Open Library: edição → search (work key) → work. */
function mockOpenLibrary(description?: string | { value: string }) {
  return vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(editionResponse))
    .mockResolvedValueOnce(jsonResponse({ docs: [{ key: '/works/OL1W' }] }))
    .mockResolvedValueOnce(jsonResponse({ description }));
}

let originalKey: string;

beforeEach(() => {
  isbnLookupService.clearCache();
  originalKey = env.GOOGLE_BOOKS_API_KEY;
  env.GOOGLE_BOOKS_API_KEY = '';
});

afterEach(() => {
  env.GOOGLE_BOOKS_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

describe('isbnLookupService.lookup', () => {
  it('mapeia a resposta da Open Library', async () => {
    vi.stubGlobal('fetch', mockOpenLibrary('Primeiro volume sobre a ditadura militar.'));

    const result = await isbnLookupService.lookup(ISBN);

    expect(result).toMatchObject({
      isbn: ISBN,
      title: 'A ditadura envergonhada',
      author: 'Elio Gaspari',
      description: 'Primeiro volume sobre a ditadura militar.',
      publisher: 'Companhia das Letras',
      publishedYear: 1988,
      coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg',
      source: 'openlibrary',
    });
  });

  it('normaliza o ISBN antes de consultar', async () => {
    const fetchMock = mockOpenLibrary('Sinopse.');
    vi.stubGlobal('fetch', fetchMock);

    const result = await isbnLookupService.lookup('978-85-359-0277-8');

    expect(result.isbn).toBe(ISBN);
    expect(fetchMock.mock.calls[0][0]).toContain(`ISBN:${ISBN}`);
  });

  it('aceita descrição no formato { value }', async () => {
    vi.stubGlobal('fetch', mockOpenLibrary({ value: 'Sinopse estruturada.' }));

    const result = await isbnLookupService.lookup(ISBN);

    expect(result.description).toBe('Sinopse estruturada.');
  });

  it('sintetiza a descrição quando o Work não tem sinopse', async () => {
    vi.stubGlobal('fetch', mockOpenLibrary(undefined));

    const result = await isbnLookupService.lookup(ISBN);

    expect(result.description).toBe(
      'A ditadura envergonhada, de Elio Gaspari. Editora Companhia das Letras, 1988. 417 páginas.',
    );
    expect(result.description).not.toBe('');
  });

  it('sintetiza a descrição quando a busca do Work falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(editionResponse))
        .mockRejectedValueOnce(new Error('network down')),
    );

    const result = await isbnLookupService.lookup(ISBN);

    expect(result.description).toContain('A ditadura envergonhada, de Elio Gaspari.');
  });

  it('lança 400 para ISBN com dígito verificador inválido', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(isbnLookupService.lookup('9788535902779')).rejects.toMatchObject({
      statusCode: 400,
      message: 'ISBN inválido',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lança 404 quando o provedor não conhece o ISBN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

    await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lança 503 quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({
      statusCode: 503,
      message: /indisponível/,
    });
  });

  it('lança 503 quando a consulta está desabilitada', async () => {
    const original = env.ISBN_LOOKUP_ENABLED;
    env.ISBN_LOOKUP_ENABLED = false;
    try {
      await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({
        statusCode: 503,
        message: 'Consulta por ISBN desabilitada',
      });
    } finally {
      env.ISBN_LOOKUP_ENABLED = original;
    }
  });

  it('não vai à rede na segunda consulta do mesmo ISBN', async () => {
    const fetchMock = mockOpenLibrary('Sinopse.');
    vi.stubGlobal('fetch', fetchMock);

    await isbnLookupService.lookup(ISBN);
    const callsAfterFirst = fetchMock.mock.calls.length;
    await isbnLookupService.lookup(ISBN);

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('cacheia o "não encontrado" e não repete a consulta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({ statusCode: 404 });
    const callsAfterFirst = fetchMock.mock.calls.length;
    await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({ statusCode: 404 });

    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it('usa a BrasilAPI quando a Open Library não conhece o ISBN brasileiro', async () => {
    const BR_ISBN = '9788550819853';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}))
        .mockResolvedValueOnce(
          jsonResponse({
            isbn: BR_ISBN,
            title: 'Fundamentals of software architecture',
            authors: ['Neal Ford', 'Mark Richards'],
            publisher: 'Alta Books',
            year: 2022,
            page_count: 448,
            synopsis: null,
            cover_url: null,
          }),
        ),
    );

    const result = await isbnLookupService.lookup(BR_ISBN);

    expect(result).toMatchObject({
      isbn: BR_ISBN,
      title: 'Fundamentals of software architecture',
      author: 'Neal Ford, Mark Richards',
      publisher: 'Alta Books',
      publishedYear: 2022,
      source: 'brasilapi',
    });
    expect(result.description).toContain('Alta Books');
  });

  it('trata o 400 "ISBN inválido" da BrasilAPI como não encontrado, sem propagar erro', async () => {
    // A BrasilAPI responde 400 para ISBN fora do prefixo brasileiro; isso não pode
    // virar um 400 para o usuário nem derrubar a busca.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}))
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'ISBN inválido', type: 'bad_request' }),
        } as Response),
    );

    await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('usa o ISBN normalizado, e não o que a BrasilAPI devolve no corpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}))
        .mockResolvedValueOnce(
          // A CBL às vezes devolve o ISBN-10 no corpo.
          jsonResponse({ isbn: '8535902775', title: 'A ditadura envergonhada', authors: [] }),
        ),
    );

    const result = await isbnLookupService.lookup(ISBN);

    expect(result.isbn).toBe(ISBN);
    expect(result.author).toBe('Autor não informado');
  });

  it('não chama o Google Books quando GOOGLE_BOOKS_API_KEY está vazia', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await expect(isbnLookupService.lookup(ISBN)).rejects.toMatchObject({ statusCode: 404 });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('googleapis.com'))).toBe(false);
  });

  it('usa o Google Books como fallback quando há chave configurada', async () => {
    env.GOOGLE_BOOKS_API_KEY = 'chave-de-teste';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // Open Library não conhece o ISBN…
        .mockResolvedValueOnce(jsonResponse({}))
        // …a BrasilAPI também não (fora do prefixo brasileiro)…
        .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response)
        // …então sobra o Google Books.
        .mockResolvedValueOnce(
          jsonResponse({
            items: [
              {
                volumeInfo: {
                  title: 'Dom Casmurro',
                  authors: ['Machado de Assis'],
                  description: 'Bentinho e Capitu.',
                  publisher: 'Garnier',
                  publishedDate: '1899',
                  imageLinks: { thumbnail: 'https://books.google.com/capa.jpg' },
                },
              },
            ],
          }),
        ),
    );

    const result = await isbnLookupService.lookup(ISBN);

    expect(result).toMatchObject({
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      publishedYear: 1899,
      source: 'googlebooks',
    });
  });
});
