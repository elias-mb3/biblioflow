import { env } from '../../config/env';
import { BookMetadata, IsbnProvider } from '../../types/isbn';
import { synthesizeDescription } from './synthesizeDescription';

const BASE_URL = 'https://openlibrary.org';

// A Open Library pede um User-Agent descritivo; requisições com UA genérico ou
// ausente podem ser bloqueadas.
const USER_AGENT = 'BiblioFlow/1.0 (+github.com/elias-mb3/biblioflow)';

interface OpenLibraryBook {
  title?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_date?: string;
  number_of_pages?: number;
  cover?: { small?: string; medium?: string; large?: string };
}

interface WorkDescription {
  description?: string | { value?: string };
}

function request(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(env.ISBN_LOOKUP_TIMEOUT_MS),
  });
}

/** `publish_date` é texto livre ("2002", "October 1, 1988"): extrai o ano. */
function parseYear(publishDate?: string): number | undefined {
  const match = publishDate?.match(/\b(\d{4})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Busca a sinopse no registro de Work. O endpoint de edição usado acima não
 * retorna descrição, e `Book.description` é obrigatório — ver ADR 0004.
 * Best-effort: qualquer falha aqui cai no texto sintetizado.
 */
async function fetchWorkDescription(isbn13: string): Promise<string | undefined> {
  try {
    const searchRes = await request(`${BASE_URL}/search.json?isbn=${isbn13}&fields=key&limit=1`);
    if (!searchRes.ok) return undefined;

    const search = (await searchRes.json()) as { docs?: { key?: string }[] };
    const workKey = search.docs?.[0]?.key;
    if (!workKey) return undefined;

    const workRes = await request(`${BASE_URL}${workKey}.json`);
    if (!workRes.ok) return undefined;

    const work = (await workRes.json()) as WorkDescription;
    const description =
      typeof work.description === 'string' ? work.description : work.description?.value;
    return description?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export const openLibraryProvider: IsbnProvider = {
  async fetchByIsbn(isbn13: string): Promise<BookMetadata | null> {
    const res = await request(
      `${BASE_URL}/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`,
    );
    if (!res.ok) return null;

    const body = (await res.json()) as Record<string, OpenLibraryBook | undefined>;
    const book = body[`ISBN:${isbn13}`];
    if (!book?.title) return null;

    const title = book.title;
    const author =
      book.authors
        ?.map((a) => a.name)
        .filter((name): name is string => Boolean(name))
        .join(', ') || 'Autor não informado';

    return {
      isbn: isbn13,
      title,
      author,
      description:
        (await fetchWorkDescription(isbn13)) ??
        synthesizeDescription({
          title,
          author,
          publisher: book.publishers?.[0]?.name,
          publishedYear: parseYear(book.publish_date),
          pageCount: book.number_of_pages,
        }),
      publisher: book.publishers?.[0]?.name,
      publishedYear: parseYear(book.publish_date),
      coverUrl: book.cover?.large ?? book.cover?.medium ?? book.cover?.small,
      source: 'openlibrary',
    };
  },
};
