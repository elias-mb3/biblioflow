import { env } from '../config/env';
import { BookMetadata, IsbnProvider } from '../types/isbn';
import { AppError } from '../utils/errors';
import { normalizeIsbn } from '../utils/isbn';
import { brasilApiProvider } from './providers/brasilApi.provider';
import { googleBooksProvider } from './providers/googleBooks.provider';
import { openLibraryProvider } from './providers/openLibrary.provider';

/**
 * Ordem de consulta (ADR 0001 e ADR 0005):
 * 1. Open Library — a mais rica (traz capa e sinopse), cobertura internacional.
 * 2. BrasilAPI/CBL — único provedor com o catálogo de edições nacionais.
 * 3. Google Books — só entra se GOOGLE_BOOKS_API_KEY estiver configurada.
 *
 * O primeiro que responder com dados vence; um provedor que não conhece o ISBN
 * devolve null e a busca segue para o próximo.
 */
const PROVIDERS: IsbnProvider[] = [openLibraryProvider, brasilApiProvider, googleBooksProvider];

interface CacheEntry {
  data: BookMetadata | null;
  expiresAt: number;
}

// A Open Library pede cache dos resultados e uso moderado da API.
const cache = new Map<string, CacheEntry>();

function readCache(isbn13: string): CacheEntry | undefined {
  const entry = cache.get(isbn13);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(isbn13);
    return undefined;
  }
  return entry;
}

function writeCache(isbn13: string, data: BookMetadata | null): void {
  const ttl = data ? env.ISBN_CACHE_TTL_MS : env.ISBN_NOT_FOUND_CACHE_TTL_MS;
  cache.set(isbn13, { data, expiresAt: Date.now() + ttl });
}

export const isbnLookupService = {
  /**
   * Consulta os metadados de um ISBN nos provedores externos, em ordem de
   * prioridade (ver ADR 0001). Lança AppError com o status adequado.
   */
  async lookup(rawIsbn: string): Promise<BookMetadata> {
    if (!env.ISBN_LOOKUP_ENABLED) {
      throw new AppError('Consulta por ISBN desabilitada', 503);
    }

    const isbn13 = normalizeIsbn(rawIsbn);
    if (!isbn13) throw new AppError('ISBN inválido', 400);

    const cached = readCache(isbn13);
    if (cached) {
      if (cached.data) return cached.data;
      throw new AppError('Livro não encontrado para o ISBN informado', 404);
    }

    let metadata: BookMetadata | null = null;
    try {
      for (const provider of PROVIDERS) {
        metadata = await provider.fetchByIsbn(isbn13);
        if (metadata) break;
      }
    } catch (err) {
      console.error('Falha ao consultar provedor de ISBN:', err);
      throw new AppError(
        'Serviço de consulta de ISBN indisponível. Tente novamente ou cadastre manualmente.',
        503,
      );
    }

    writeCache(isbn13, metadata);
    if (!metadata) throw new AppError('Livro não encontrado para o ISBN informado', 404);
    return metadata;
  },

  /**
   * Limpa o cache em memória. Necessário nos testes: `fileParallelism: false`
   * faz os arquivos rodarem no mesmo processo, e o cache sobreviveria entre eles.
   */
  clearCache(): void {
    cache.clear();
  },
};
