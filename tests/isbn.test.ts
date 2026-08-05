import { describe, it, expect } from 'vitest';
import { normalizeIsbn, isValidIsbn } from '../src/utils/isbn';

describe('normalizeIsbn', () => {
  it('mantém um ISBN-13 já normalizado', () => {
    expect(normalizeIsbn('9788535902778')).toBe('9788535902778');
  });

  it('remove hífens de um ISBN-13', () => {
    expect(normalizeIsbn('978-85-359-0277-8')).toBe('9788535902778');
  });

  it('converte ISBN-10 para ISBN-13', () => {
    expect(normalizeIsbn('8535902775')).toBe('9788535902778');
  });

  it('aceita ISBN-10 com dígito verificador X', () => {
    expect(normalizeIsbn('080442957X')).toBe('9780804429573');
    expect(normalizeIsbn('0-8044-2957-X')).toBe('9780804429573');
  });

  it('remove o rótulo "ISBN:" antes do número', () => {
    expect(normalizeIsbn('ISBN: 9788535902778')).toBe('9788535902778');
    expect(normalizeIsbn('ISBN-13: 978-85-359-0277-8')).toBe('9788535902778');
  });

  it('ignora espaços em volta', () => {
    expect(normalizeIsbn('  9788535902778  ')).toBe('9788535902778');
  });

  it('rejeita dígito verificador inválido', () => {
    expect(normalizeIsbn('9788535902779')).toBeNull();
    expect(normalizeIsbn('030640615X')).toBeNull();
  });

  it('rejeita entrada vazia ou sem formato de ISBN', () => {
    expect(normalizeIsbn('')).toBeNull();
    expect(normalizeIsbn('abc')).toBeNull();
    expect(normalizeIsbn('123')).toBeNull();
  });
});

describe('isValidIsbn', () => {
  it('aceita ISBN-13 e ISBN-10 válidos', () => {
    expect(isValidIsbn('9788535902778')).toBe(true);
    expect(isValidIsbn('8535902775')).toBe(true);
  });

  it('recusa ISBN inválido', () => {
    expect(isValidIsbn('9788535902779')).toBe(false);
    expect(isValidIsbn('')).toBe(false);
  });
});
