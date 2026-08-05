export type IsbnSource = 'openlibrary' | 'brasilapi' | 'googlebooks';

/**
 * Metadados de um livro obtidos de um provedor externo a partir do ISBN.
 * Campos ausentes no provedor são omitidos (e não `null`), diferente do shape
 * de `Book`, que vem do Prisma.
 */
export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  description: string;
  publisher?: string;
  publishedYear?: number;
  coverUrl?: string;
  source: IsbnSource;
}

export interface IsbnPreview extends BookMetadata {
  alreadyRegistered: boolean;
  existingBookId?: string;
}

export interface IsbnProvider {
  fetchByIsbn(isbn13: string): Promise<BookMetadata | null>;
}
