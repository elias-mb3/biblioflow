/**
 * Monta uma descrição a partir dos metadados disponíveis, para quando o provedor
 * não tem sinopse. `Book.description` é NOT NULL e `createBookSchema` exige
 * `min(1)`, então o resultado nunca pode ser vazio — ver ADR 0004.
 */
export function synthesizeDescription(input: {
  title: string;
  author: string;
  publisher?: string;
  publishedYear?: number;
  pageCount?: number;
}): string {
  const { title, author, publisher, publishedYear, pageCount } = input;
  const parts = [`${title}, de ${author}.`];

  if (publisher && publishedYear) parts.push(`Editora ${publisher}, ${publishedYear}.`);
  else if (publisher) parts.push(`Editora ${publisher}.`);
  else if (publishedYear) parts.push(`Publicado em ${publishedYear}.`);

  if (pageCount) parts.push(`${pageCount} páginas.`);

  return parts.join(' ');
}
