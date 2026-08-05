import ISBN from 'isbn3';

// A lib isbn3 não remove rótulos textuais ("ISBN: 978…"), só separadores dentro do número.
// Como o valor pode vir colado de uma ficha catalográfica ou de um leitor de código de barras,
// o rótulo é retirado aqui antes do parse.
const ISBN_LABEL = /^\s*ISBN(?:[-\s]?1[03])?\s*:?\s*/i;

/**
 * Normaliza um ISBN para ISBN-13 sem hífens — o formato gravado em `Book.isbn`.
 * Aceita ISBN-10 (convertendo), hífens, espaços e o rótulo "ISBN:".
 * Retorna `null` quando o dígito verificador é inválido ou o formato é irreconhecível.
 */
export function normalizeIsbn(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  return ISBN.asIsbn13(raw.replace(ISBN_LABEL, '').trim());
}

export function isValidIsbn(raw: string): boolean {
  return normalizeIsbn(raw) !== null;
}
