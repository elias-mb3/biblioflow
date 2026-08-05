import { env } from '../../config/env';
import { BookMetadata, IsbnProvider } from '../../types/isbn';
import { synthesizeDescription } from './synthesizeDescription';

const BASE_URL = 'https://brasilapi.com.br/api/isbn/v1';

interface BrasilApiBook {
  title?: string;
  subtitle?: string | null;
  authors?: string[];
  publisher?: string | null;
  synopsis?: string | null;
  year?: number | null;
  page_count?: number | null;
  cover_url?: string | null;
}

/**
 * Provedor da Agência Brasileira do ISBN (CBL), via BrasilAPI. Gratuita e sem
 * chave. É o único provedor com catálogo de edições nacionais — a Open Library
 * não conhece boa parte dos ISBNs brasileiros (ADR 0005).
 *
 * Cobre apenas ISBNs de prefixo brasileiro (978-85 / 978-65). Para os demais
 * responde 400 com a mensagem "ISBN inválido", que significa "fora do meu
 * escopo" e **não** dígito verificador incorreto — por isso qualquer resposta
 * não-OK vira `null` (segue para o próximo provedor), nunca um erro propagado.
 */
export const brasilApiProvider: IsbnProvider = {
  async fetchByIsbn(isbn13: string): Promise<BookMetadata | null> {
    const res = await fetch(`${BASE_URL}/${isbn13}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(env.ISBN_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const book = (await res.json()) as BrasilApiBook;
    if (!book.title) return null;

    const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
    // Registros antigos da CBL costumam vir com authors vazio.
    const author = book.authors?.filter(Boolean).join(', ') || 'Autor não informado';
    const publisher = book.publisher ?? undefined;
    const publishedYear = book.year ?? undefined;

    return {
      // A CBL às vezes devolve o ISBN-10 no corpo; o normalizado é o nosso.
      isbn: isbn13,
      title,
      author,
      description:
        book.synopsis?.trim() ||
        synthesizeDescription({
          title,
          author,
          publisher,
          publishedYear,
          pageCount: book.page_count ?? undefined,
        }),
      publisher,
      publishedYear,
      coverUrl: book.cover_url ?? undefined,
      source: 'brasilapi',
    };
  },
};
