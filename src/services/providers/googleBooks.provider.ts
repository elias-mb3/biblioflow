import { env } from '../../config/env';
import { BookMetadata, IsbnProvider } from '../../types/isbn';

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

interface VolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  publisher?: string;
  publishedDate?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
}

function parseYear(publishedDate?: string): number | undefined {
  const match = publishedDate?.match(/\b(\d{4})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Fallback opcional. Requisições anônimas ao Google Books são recusadas com 429
 * (quota zero para projeto anônimo), então sem chave o provedor nem tenta — ver ADR 0001.
 */
export const googleBooksProvider: IsbnProvider = {
  async fetchByIsbn(isbn13: string): Promise<BookMetadata | null> {
    if (!env.GOOGLE_BOOKS_API_KEY) return null;

    const res = await fetch(`${BASE_URL}?q=isbn:${isbn13}&key=${env.GOOGLE_BOOKS_API_KEY}`, {
      signal: AbortSignal.timeout(env.ISBN_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { items?: { volumeInfo?: VolumeInfo }[] };
    const info = body.items?.[0]?.volumeInfo;
    if (!info?.title) return null;

    const title = info.title;
    const author = info.authors?.join(', ') || 'Autor não informado';
    const year = parseYear(info.publishedDate);

    return {
      isbn: isbn13,
      title,
      author,
      description: info.description?.trim() || `${title}, de ${author}.`,
      publisher: info.publisher,
      publishedYear: year,
      coverUrl: info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail,
      source: 'googlebooks',
    };
  },
};
