import { Paginated } from './pagination.model';

export interface Book {
  id: string;
  registrationCode: string;
  title: string;
  author: string;
  description: string;
  quantity: number;
  // O Prisma devolve `null` (não `undefined`) para coluna opcional vazia — daí
  // serem campos obrigatórios da interface, com `null` no tipo.
  isbn: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: number | null;
  createdAt: string;
}

export type PaginatedBooks = Paginated<Book>;

export interface CreateBookRequest {
  title: string;
  author: string;
  description: string;
  quantity: number;
  isbn?: string;
}

export type UpdateBookRequest = Partial<CreateBookRequest>;

/** Campos aceitos por `GET /books/search?field=` — espelha o enum de `bookSearchSchema` no backend. */
export type BookSearchField = 'title' | 'author' | 'registrationCode' | 'isbn';

export interface BookSearchParams {
  q: string;
  field?: BookSearchField;
}

/**
 * Resposta de `GET /books/isbn/:isbn`. Vem do mapeamento do provedor externo, e
 * não do Prisma: campos ausentes são omitidos, por isso `?:` em vez de `| null`.
 */
export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  description: string;
  publisher?: string;
  publishedYear?: number;
  coverUrl?: string;
  source: 'openlibrary' | 'brasilapi' | 'googlebooks';
  alreadyRegistered: boolean;
  existingBookId?: string;
}

export interface CreateBookFromIsbnRequest {
  isbn: string;
  quantity: number;
}

/** `incremented: true` quando o ISBN já existia e o estoque foi somado. */
export type BookFromIsbnResponse = Book & { incremented: boolean };
