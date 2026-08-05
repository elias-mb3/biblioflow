# 0002 — O ISBN é persistido como ISBN-13 normalizado, em coluna opcional e única

- **Status:** Aceito
- **Data:** 2026-08-05
- **Contexto da feature:** [`docs/plans/cadastro-livros-por-isbn.md`](../plans/cadastro-livros-por-isbn.md)
- **Frentes afetadas:** DATABASE · BACKEND

## Contexto

O mesmo livro pode ser informado como ISBN-10 (`8535902775`), ISBN-13 (`9788535902778`), com hífens
(`978-85-359-0277-8`), com espaços ou com o prefixo `ISBN:`. Todas essas formas identificam a mesma
obra. Se cada uma virar uma linha diferente em `books`, a deduplicação não funciona e a busca por
ISBN fica não-determinística.

Ao mesmo tempo, o acervo já existente foi cadastrado manualmente e **não tem ISBN**: a coluna não
pode ser obrigatória, e o cadastro manual precisa continuar aceito sem ISBN (livros antigos,
doações, edições sem registro).

## Decisão

`Book.isbn` é `String? @unique`, e o valor gravado é sempre o **ISBN-13 sem hífens nem espaços**.

- A normalização acontece em `src/utils/isbn.ts` (`normalizeIsbn`), que usa a lib
  [`isbn3`](https://www.npmjs.com/package/isbn3) — v2.0.10, zero dependências, tipagem TS inclusa.
  Ela valida o dígito verificador, remove separadores e converte ISBN-10 → ISBN-13.
- Nenhum caminho de escrita grava um ISBN não normalizado: `bookService.create`, `bookService.update`
  e `bookService.createFromIsbn` chamam `normalizeIsbn` antes de tocar o repositório.
- ISBN com dígito verificador inválido é rejeitado com 400 `'ISBN inválido'` — não é gravado "como
  veio".
- O `registrationCode` continua sendo o identificador interno do exemplar, gerado e imutável. O
  ISBN **não** o substitui: identificam coisas diferentes (a obra publicada vs. o exemplar físico
  daquele acervo).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Guardar o ISBN exatamente como digitado | Quebra o `@unique` e a deduplicação: `978-85-359-0277-8` e `9788535902778` conviveriam como registros distintos. |
| Guardar ISBN-10 quando informado como ISBN-10 | Nem todo ISBN-13 tem ISBN-10 equivalente (prefixo `979`). ISBN-13 é o único formato que representa todo o espaço de ISBNs. |
| Coluna `NOT NULL` com valor sentinela (`''`) | Uma string vazia repetida viola o `@unique` já na segunda linha sem ISBN, e obrigaria a inventar um valor para todo livro legado. |
| Validação de checksum escrita à mão | ~30 linhas de mod-11/mod-10 mais os casos de borda (dígito `X`, prefixos, variantes Unicode de hífen). A lib resolve isso com zero dependências e é testada. |
| `isbn` como chave primária de `books` | O acervo tem exemplares sem ISBN e pode ter duplicatas físicas do mesmo título. A PK precisa ser o `id` do exemplar. |

## Consequências

**Positivas**
- Deduplicação confiável: `bookRepository.findByIsbn` sempre encontra a obra, qualquer que tenha
  sido o formato digitado.
- A busca por ISBN (`GET /books/search?field=isbn`) é determinística.
- O acervo legado migra sem backfill. **Verificado**: no SQLite um índice único aceita múltiplos
  `NULL` — o próprio repositório já depende disso, já que `users.cpf` é `String? @unique` e todo
  gestor é gravado com `cpf` nulo (`prisma/seed.ts`, `tests/security.test.ts`).

**Negativas / custo aceito**
- Quem consulta o banco direto precisa normalizar antes de comparar — um `WHERE isbn = '978-85-...'`
  escrito à mão não casa. Mitigado por toda leitura passar pelo repositório.
- Livros anteriores à adoção do ISBN-13 (pré-2007) são gravados sob o ISBN-13 convertido, que pode
  não ser o número impresso na capa. É o trade-off aceito para ter um formato único.

**Como reverter**
Caro se houver dados. Voltar a guardar o formato original exigiria migração de dados e a remoção
do `@unique` — deduplicação passaria a ser feita em aplicação. Por isso a decisão está registrada.

## Referências

- [`isbn3` no npm](https://www.npmjs.com/package/isbn3)
- [ISBN Validation Algorithm: Handling Edge Cases in TypeScript — SitePoint](https://www.sitepoint.com/isbn-validation-typescript-algorithm-edge-cases/)
- `prisma/migrations/20260519215725_init/migration.sql` — precedente de índice único em coluna
  nula (`users_cpf_key`).
