# Plano técnico: Cadastro de livros por ISBN

> Discovery: [`docs/plans/cadastro-livros-por-isbn.md`](./cadastro-livros-por-isbn.md)
> ADRs: [0001](../adr/0001-open-library-como-provedor-primario-de-metadados.md), [0002](../adr/0002-isbn13-normalizado-como-chave-natural.md), [0003](../adr/0003-isbn-duplicado-incrementa-estoque.md), [0004](../adr/0004-descricao-obtida-do-work-com-fallback-sintetizado.md)
> Frentes: **DATABASE · BACKEND · FRONTEND**

## Resumo de engenharia

A feature adiciona quatro colunas nulas a `books`, dois endpoints de `MANAGER` sob `/api/v1/books`
e um bloco de busca por ISBN no formulário de exemplar do painel do gestor. O caminho crítico é a
camada de integração externa (`isbnLookup.service` + dois providers), porque é o único código do
projeto que faz I/O de rede — tudo mais segue padrões já estabelecidos no repo. A maior incerteza
não é técnica e sim de cobertura: a Open Library pode não conhecer um ISBN nacional, então **todo o
fluxo manual permanece intacto** e o lookup degrada para 404/503 sem bloquear o cadastro.

Dois pontos merecem atenção na execução: a ordem de registro das rotas em
`src/routes/books.ts:13`, e o fato de o Prisma devolver `null` (não `undefined`) para colunas
opcionais, o que muda a tipagem no frontend.

**Decisões que viraram ADR:**

| ADR | Decisão | Impacto |
|---|---|---|
| 0001 | Open Library primário; Google Books só com `GOOGLE_BOOKS_API_KEY` | BE |
| 0002 | ISBN-13 normalizado, coluna `String? @unique` | DB · BE |
| 0003 | `POST /books/isbn` duplicado incrementa `quantity` (200) em vez de 409 | BE · FE |
| 0004 | Descrição via 2ª chamada ao Work, com fallback sintetizado | BE |

---

## Contratos

Fechados antes de qualquer implementação — as três frentes dependem destes três blocos serem
coerentes entre si.

### 1. Contrato de dados

```prisma
model Book {
  id               String   @id @default(uuid())
  registrationCode String   @unique
  title            String
  description      String
  author           String
  quantity         Int      @default(1)
  isbn             String?  @unique   // ← novo
  coverUrl         String?            // ← novo
  publisher        String?            // ← novo
  publishedYear    Int?               // ← novo
  createdAt        DateTime @default(now())

  rentals   Rental[]
  donations Donation[]

  @@map("books")
}
```

- **Nullability:** as quatro colunas são opcionais. Obrigatoriedade quebraria as linhas já
  cadastradas manualmente (o acervo atual não tem ISBN) e impediria o cadastro de doações e edições
  antigas sem registro. `description` continua `NOT NULL` — ver ADR 0004.
- **Constraints/índices:** `isbn String? @unique` gera `books_isbn_key`. É a constraint que sustenta
  `bookRepository.findByIsbn` e a deduplicação do ADR 0003. Nenhum índice adicional: `coverUrl`,
  `publisher` e `publishedYear` só são lidos junto do registro, nunca filtrados.
- **Dado legado:** **nenhum backfill.** No SQLite um índice único aceita múltiplos `NULL` — o
  próprio repositório já depende disso: `users.cpf` é `String? @unique` e todo gestor é gravado com
  `cpf` nulo (`prisma/seed.ts:11`, `tests/security.test.ts`). As quatro colunas entram por
  `ALTER TABLE ADD COLUMN` sem reconstrução de tabela, porque todas são nulas e não têm default.
- **Origem dos valores:** `publishedYear` é `Int?` porque a Open Library devolve `publish_date` como
  texto livre (`"2002"`, `"October 1, 1988"`) — o provider extrai os 4 dígitos por regex e omite o
  campo quando não encontra.

### 2. Contrato de API

#### `GET /api/v1/books/isbn/{isbn}` 👤 MANAGER

Consulta os metadados **sem persistir nada**. Alimenta o preenchimento do formulário.

Request: `isbn` no path, em qualquer formato (`9788535902778`, `978-85-359-0277-8`, `8535902775`).

Response `200`:
```json
{
  "isbn": "9788535902778",
  "title": "A ditadura envergonhada",
  "author": "Elio Gaspari",
  "description": "Primeiro volume da série sobre a ditadura militar brasileira…",
  "publisher": "Companhia das Letras",
  "publishedYear": 2002,
  "coverUrl": "https://covers.openlibrary.org/b/id/15152634-L.jpg",
  "source": "openlibrary",
  "alreadyRegistered": false
}
```

Quando o ISBN já está no acervo, acrescenta `"alreadyRegistered": true` e
`"existingBookId": "<uuid>"`. Campos sem valor no provedor são **omitidos** do JSON (não vêm como
`null`) — ver a nota de coerência abaixo.

Erros:

| Status | `erro` | Quando |
|---|---|---|
| 400 | `ISBN inválido` | Dígito verificador incorreto, formato irreconhecível ou string vazia |
| 401 | `Token de autenticação não fornecido` / `Token inválido ou expirado` | `authenticate` (`src/middlewares/auth.ts`) |
| 403 | `Acesso negado: permissão insuficiente` | Token de `USER` — `requireRole('MANAGER')` |
| 404 | `Livro não encontrado para o ISBN informado` | ISBN válido, ausente em todos os provedores |
| 429 | `Muitas tentativas. Tente novamente mais tarde.` | `isbnLookupRateLimiter` |
| 503 | `Serviço de consulta de ISBN indisponível. Tente novamente ou cadastre manualmente.` | Timeout ou erro de rede nos provedores |
| 503 | `Consulta por ISBN desabilitada` | `ISBN_LOOKUP_ENABLED=false` |

#### `POST /api/v1/books/isbn` 👤 MANAGER

Consulta e persiste. **Dois status de sucesso** — ver ADR 0003.

Request:
```json
{ "isbn": "9788535902778", "quantity": 2 }
```
`quantity` é opcional, default `1`.

Response `201` — ISBN inédito, livro criado:
```json
{
  "id": "3f1c…", "registrationCode": "BIB-LKZP3A4-C9F2E1",
  "title": "A ditadura envergonhada", "author": "Elio Gaspari",
  "description": "…", "quantity": 2,
  "isbn": "9788535902778", "coverUrl": "https://covers.openlibrary.org/b/id/15152634-L.jpg",
  "publisher": "Companhia das Letras", "publishedYear": 2002,
  "createdAt": "2026-08-05T12:00:00.000Z",
  "incremented": false
}
```

Response `200` — ISBN já cadastrado, estoque somado: mesmo shape, `quantity` atualizado e
`"incremented": true`.

Erros: os mesmos da tabela acima (400/401/403/404/429/503).

#### `POST /api/v1/books` e `PUT /api/v1/books/{id}` — alterados

Passam a aceitar `isbn` opcional no corpo. Novo erro:

| Status | `erro` | Quando |
|---|---|---|
| 409 | `Já existe um livro cadastrado com este ISBN` | `isbn` normalizado colide com outro registro |

#### `GET /api/v1/books/search` — alterado

`field` passa a aceitar `isbn`, e a busca genérica (sem `field`) passa a incluir `isbn` no `OR`.

### 3. Contrato de tipos do frontend

```typescript
// frontend/src/app/core/models/book.model.ts

export interface Book {
  id: string;
  registrationCode: string;
  title: string;
  author: string;
  description: string;
  quantity: number;
  isbn: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: number | null;
  createdAt: string;
}

export interface BookMetadata {
  isbn: string;
  title: string;
  author: string;
  description: string;
  publisher?: string;
  publishedYear?: number;
  coverUrl?: string;
  source: 'openlibrary' | 'googlebooks';
  alreadyRegistered: boolean;
  existingBookId?: string;
}

export interface CreateBookFromIsbnRequest {
  isbn: string;
  quantity: number;
}

export type BookFromIsbnResponse = Book & { incremented: boolean };

export interface CreateBookRequest {
  title: string;
  author: string;
  description: string;
  quantity: number;
  isbn?: string;
}

type SearchField = 'title' | 'author' | 'registrationCode' | 'isbn';
```

> **Verificação de coerência.** Os dois shapes divergem de propósito e isso é a armadilha desta
> feature:
>
> - `Book` vem do **Prisma**, que devolve `null` — não `undefined` — para coluna opcional vazia.
>   Por isso os campos novos são `string | null` **obrigatórios na interface**, e não `isbn?: string`.
>   Declarar `isbn?: string` faria `book.isbn === undefined` nunca ser verdade em runtime, e
>   `@if (b.isbn)` continuaria correto por acaso enquanto `book.isbn ?? 'x'` silenciosamente
>   retornaria `null`.
> - `BookMetadata` vem do **nosso mapeamento de provider**, onde campos ausentes são omitidos do
>   objeto. Ali `?: string` é o tipo certo.
> - Todo campo de resposta existe no schema Prisma, exceto `source`, `alreadyRegistered`,
>   `existingBookId` e `incremented`, que são calculados no service e **não são persistidos**.

---

## Frente DATABASE

**Arquivos:** `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`

- [ ] `[DB]` Em `prisma/schema.prisma`, model `Book`: adicionar `isbn String? @unique`,
      `coverUrl String?`, `publisher String?`, `publishedYear Int?` conforme o contrato de dados.
- [ ] `[DB]` Gerar a migração: `npm run db:migrate -- --name add_isbn_to_book`. O padrão de nome
      segue `prisma/migrations/20260519215725_init/`.
- [ ] `[DB]` Conferir o SQL gerado: deve conter quatro `ALTER TABLE "books" ADD COLUMN` e um
      `CREATE UNIQUE INDEX "books_isbn_key" ON "books"("isbn")`. **Se aparecer recriação de tabela
      (`new_books` + `INSERT INTO … SELECT`), parar** — significa que alguma coluna saiu como
      `NOT NULL`.
- [ ] `[DB]` Rodar `npm run db:generate` e confirmar que `src/generated/prisma/models/Book.ts`
      reflete os campos. **Não editar `src/generated/prisma/` manualmente.**
- [ ] `[DB]` Em `prisma/seed.ts:33`, acrescentar ao `book.upsert` o `isbn: '9788535902778'`,
      `publisher: 'Companhia das Letras'`, `publishedYear: 2002` — ISBN real, usado também na
      validação manual.

**Rollback:** a migração é aditiva e só cria colunas nulas, então o código anterior continua
funcionando com o schema novo (ele simplesmente ignora as colunas). Reverter de verdade exige, no
SQLite, recriar `books` sem as quatro colunas e recopiar as linhas — os dados de ISBN/capa seriam
perdidos, mas nenhum dado pré-existente. Na prática: gerar uma migração inversa, nunca editar a
migração já aplicada.

## Frente BACKEND

**Arquivos novos:** `src/utils/isbn.ts`, `src/types/isbn.ts`,
`src/services/providers/openLibrary.provider.ts`, `src/services/providers/googleBooks.provider.ts`,
`src/services/isbnLookup.service.ts`, `tests/isbn.test.ts`, `tests/isbnLookup.test.ts`,
`tests/books-isbn.test.ts`
**Arquivos editados:** `src/config/env.ts`, `src/schemas/book.ts`,
`src/repositories/book.repository.ts`, `src/services/book.service.ts`,
`src/controllers/book.controller.ts`, `src/routes/books.ts`, `src/middlewares/rateLimit.ts`,
`src/docs/openapi.ts`

### Configuração

- [ ] `[BE]` Instalar a dependência: `npm i isbn3` (v2.0.10, zero deps, tipagem própria — ADR 0002).
- [ ] `[BE]` Em `src/config/env.ts`, acrescentar ao objeto `env` (linhas 18-28), reusando o
      `parseBool` já definido em `src/config/env.ts:13`:
      `ISBN_LOOKUP_ENABLED: parseBool(process.env.ISBN_LOOKUP_ENABLED, true)`,
      `ISBN_LOOKUP_TIMEOUT_MS` (default `5000`), `ISBN_CACHE_TTL_MS` (default `86400000`),
      `ISBN_NOT_FOUND_CACHE_TTL_MS` (default `3600000`),
      `ISBN_LOOKUP_RATE_LIMIT_MAX` (default `30`),
      `GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY ?? ''`.
      Não mexer em `validateEnv()`: nenhuma das novas é obrigatória em produção.

### Utilitário de ISBN

- [ ] `[BE]` Criar `src/utils/isbn.ts` com `normalizeIsbn(raw: string): string | null` (usa
      `ISBN.parse()` do `isbn3` e devolve o `isbn13` **sem hífens**) e
      `isValidIsbn(raw: string): boolean`.
- [ ] `[BE]` Criar `tests/isbn.test.ts` — unitário puro, sem banco e sem rede. Casos: ISBN-13 com e
      sem hífens; ISBN-10 (`8535902775`) convertido para `9788535902778`; ISBN-10 terminado em `X`;
      entrada com prefixo `ISBN:`; dígito verificador errado → `null`; string vazia → `null`.

### Integração externa

- [ ] `[BE]` Criar `src/types/isbn.ts` com a interface `BookMetadata` do contrato (sem
      `alreadyRegistered`/`existingBookId`, que são acrescentados pelo `bookService`).
- [ ] `[BE]` Criar `src/services/providers/openLibrary.provider.ts` exportando
      `openLibraryProvider.fetchByIsbn(isbn13: string): Promise<BookMetadata | null>`:
  - [ ] `fetch` para `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn13>&format=json&jscmd=data`
        com header `User-Agent: BiblioFlow/1.0 (+github.com/elias-mb3/biblioflow)` (exigido pela
        política de uso — ADR 0001) e `signal: AbortSignal.timeout(env.ISBN_LOOKUP_TIMEOUT_MS)`.
  - [ ] Não encontrado: corpo `{}` ou chave `ISBN:<isbn13>` ausente → **retornar `null`**, não lançar.
  - [ ] Mapeamento: `title`; `author = authors.map(a => a.name).join(', ')` com fallback
        `'Autor não informado'`; `publisher = publishers?.[0]?.name`;
        `publishedYear` = primeiro grupo de 4 dígitos de `publish_date` via `/\b(\d{4})\b/`;
        `coverUrl = cover?.large ?? cover?.medium ?? cover?.small`; `source: 'openlibrary'`.
  - [ ] Descrição (ADR 0004): resolver o Work via
        `https://openlibrary.org/search.json?isbn=<isbn13>&fields=key&limit=1` → `docs[0].key`, e
        então `https://openlibrary.org/works/{key}.json` → `description`, normalizando os dois
        formatos possíveis (`string` ou `{ type, value }`). **Best-effort**: qualquer erro nessa
        etapa cai no fallback sem derrubar o lookup.
  - [ ] Fallback de descrição: `"<title>, de <author>. Editora <publisher>, <ano>. <n> páginas."`,
        montado só com o que existir. **Nunca string vazia** — reprovaria no `min(1)` do Zod.
- [ ] `[BE]` Criar `src/services/providers/googleBooks.provider.ts` com a mesma assinatura:
      `if (!env.GOOGLE_BOOKS_API_KEY) return null` **antes de qualquer fetch**; senão consulta
      `https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn13>&key=<chave>` e mapeia
      `items[0].volumeInfo` (`title`, `authors`, `description`, `publisher`, `publishedDate`,
      `imageLinks.thumbnail`), com `source: 'googlebooks'`.
- [ ] `[BE]` Criar `src/services/isbnLookup.service.ts`:
  - [ ] Cache `Map<string, { data: BookMetadata | null; expiresAt: number }>`, com
        `ISBN_CACHE_TTL_MS` para acerto e `ISBN_NOT_FOUND_CACHE_TTL_MS` para "não encontrado".
  - [ ] `lookup(rawIsbn: string): Promise<BookMetadata>`: normaliza (→ `AppError('ISBN inválido', 400)`
        se `null`); checa `env.ISBN_LOOKUP_ENABLED` (→ `AppError('Consulta por ISBN desabilitada', 503)`);
        consulta cache; tenta Open Library; se `null`, tenta Google Books; ambos `null` →
        `AppError('Livro não encontrado para o ISBN informado', 404)`.
  - [ ] Erro de rede/timeout → `AppError('Serviço de consulta de ISBN indisponível. Tente novamente ou cadastre manualmente.', 503)`,
        com `console.error` do erro original (mesmo estilo de `src/middlewares/errorHandler.ts:22`).
  - [ ] Exportar `clearCache()` — **obrigatório**, senão os testes vazam estado entre casos.
- [ ] `[BE]` Criar `tests/isbnLookup.test.ts`, **sem rede real**, com `vi.stubGlobal('fetch', vi.fn())`
      e `isbnLookupService.clearCache()` no `beforeEach`. Casos: resposta OK da Open Library →
      metadata mapeada, incluindo `publishedYear` extraído de `"October 1, 1988"`; corpo `{}` → 404;
      `fetch` rejeitando com `AbortError` → 503; segunda chamada do mesmo ISBN **não** dispara novo
      `fetch`; com `GOOGLE_BOOKS_API_KEY` vazia o provider do Google não faz `fetch`; falha só na
      chamada do Work → metadata volta com a descrição de fallback.

### Camada de repositório

- [ ] `[BE]` Em `src/repositories/book.repository.ts`, acrescentar
      `findByIsbn(isbn: string)` → `prisma.book.findUnique({ where: { isbn } })`, junto de
      `findByRegistrationCode` (linha 11).
- [ ] `[BE]` Acrescentar `incrementQuantity(id: string, by: number)` →
      `prisma.book.update({ where: { id }, data: { quantity: { increment: by } } })`.
- [ ] `[BE]` Em `search()` (linha 27), acrescentar o ramo `field === 'isbn'` →
      `{ isbn: { contains: q } }` e incluir `{ isbn: { contains: q } }` no `OR` da busca genérica.

### Validação (Zod)

- [ ] `[BE]` Em `src/schemas/book.ts`, acrescentar a `createBookSchema` (linha 3) e a
      `updateBookSchema` (linha 10):
      `isbn: z.string().refine(isValidIsbn, { message: 'ISBN inválido' }).optional()`.
- [ ] `[BE]` Em `bookSearchSchema` (linha 17), trocar o enum da linha 19 por
      `z.enum(['title', 'author', 'registrationCode', 'isbn'])`.
- [ ] `[BE]` Acrescentar `isbnParamSchema = z.object({ isbn: z.string().min(10) })` e
      `createBookFromIsbnSchema = z.object({ isbn: z.string(), quantity: z.number().int().positive().default(1) })`,
      exportando também `CreateBookFromIsbnInput`.

### Camada de serviço (regras de negócio)

- [ ] `[BE]` Em `src/services/book.service.ts`, `create()` (linha 21): normalizar `input.isbn` quando
      presente e, se `findByIsbn` retornar registro, lançar
      `new AppError('Já existe um livro cadastrado com este ISBN', 409)` — mesmo estilo do 409 já
      usado em `delete()` (linha 31).
- [ ] `[BE]` Em `update()` (linha 26): mesma normalização e checagem, **ignorando o próprio `id`**
      (um `PUT` que reenvia o ISBN atual não pode dar 409).
- [ ] `[BE]` Acrescentar `previewByIsbn(rawIsbn: string)`: chama `isbnLookupService.lookup()` e
      devolve `{ ...metadata, alreadyRegistered, existingBookId? }` consultando `findByIsbn`.
- [ ] `[BE]` Acrescentar `createFromIsbn({ isbn, quantity })` (ADR 0003): faz o lookup; se
      `findByIsbn` achar registro, chama `incrementQuantity` e devolve
      `{ ...book, incremented: true }`; senão cria via `bookRepository.create` com
      `registrationCode: generateRegistrationCode()` e devolve `{ ...book, incremented: false }`.
      O `registrationCode` continua interno e imutável — o ISBN **não** o substitui.

### Controller e rotas

- [ ] `[BE]` Em `src/controllers/book.controller.ts`, acrescentar `previewByIsbn` e `createFromIsbn`
      no padrão dos handlers existentes (`try/catch` + `next(err)`), validando o parâmetro de rota
      com `isbnParamSchema.safeParse(req.params)` e respondendo
      `400 { erro: 'Parâmetros inválidos', detalhes }` — igual ao que `search` já faz (linha 18).
      Em `createFromIsbn`, o status é `result.incremented ? 200 : 201`.
- [ ] `[BE]` Em `src/middlewares/rateLimit.ts`, exportar
      `isbnLookupRateLimiter = createRateLimiter({ limit: env.ISBN_LOOKUP_RATE_LIMIT_MAX, skip: () => env.NODE_ENV === 'test' })`.
      O `skip` em test é **obrigatório** — sem ele a suíte flakeia, como já previsto no
      `authRateLimiter` (`src/middlewares/rateLimit.ts:24`).
- [ ] `[BE]` Em `src/routes/books.ts`, registrar **entre as linhas 12 e 13**, antes de
      `booksRouter.get('/:id', …)`:
      ```ts
      booksRouter.get('/isbn/:isbn', requireRole('MANAGER'), isbnLookupRateLimiter, bookController.previewByIsbn);
      booksRouter.post('/isbn', requireRole('MANAGER'), isbnLookupRateLimiter, validate(createBookFromIsbnSchema), bookController.createFromIsbn);
      ```
      **Registrar depois de `/:id` faz `/books/isbn/9788535902778` cair em `getById` e responder 404.**
- [ ] `[BE]` Criar `tests/books-isbn.test.ts` no padrão de `tests/books.test.ts` (`beforeEach`
      limpando `rental`/`donation`/`book`/`user` + `createManagerAndLogin`/`createUserAndLogin` de
      `tests/helpers.ts`), com `vi.stubGlobal('fetch', …)` e `clearCache()`:
  - [ ] `GET /books/isbn/9788535902778` → 200 com `title`, `author` e `isbn` normalizado.
  - [ ] `GET /books/isbn/978-85-359-0277-8` → mesmo resultado (normalização de hífens).
  - [ ] `GET /books/isbn/9788535902779` (checksum errado) → 400 `'ISBN inválido'`.
  - [ ] Provedor sem resultado → 404.
  - [ ] `fetch` rejeitando → 503 com mensagem sugerindo cadastro manual.
  - [ ] `POST /books/isbn` → 201, `registrationCode` presente, `isbn` persistido, `incremented: false`.
  - [ ] `POST /books/isbn` repetido → **200**, `quantity` somado, `incremented: true`, e
        `prisma.book.count()` continua `1`.
  - [ ] `POST /books` manual com `isbn` já existente → 409.
  - [ ] `PUT /books/:id` reenviando o próprio `isbn` → 200 (não 409).
  - [ ] 401 sem token e 403 com token de `USER` nas duas rotas novas.
  - [ ] **Regressão de roteamento:** `GET /books/:id` de um livro existente continua 200.

### Documentação OpenAPI

- [ ] `[BE]` Em `src/docs/openapi.ts`: acrescentar `isbn`, `coverUrl`, `publisher`, `publishedYear`
      ao `bookSchema` (linha 36), todos com `nullable: true`.
- [ ] `[BE]` Criar `bookMetadataSchema` e registrá-lo em `components.schemas` como `BookMetadata`
      (junto de `Book`, linha 128).
- [ ] `[BE]` Acrescentar os paths `'/books/isbn/{isbn}'` e `'/books/isbn'` **entre `'/books/search'`
      (linha 347) e `'/books/{id}'` (linha 374)**, tag `Livros`, `security: [{ bearerAuth: [] }]`,
      summary com o prefixo 👤 usado no arquivo, e todas as respostas da tabela de erros — incluindo
      429 e 503, que ainda não existem em `errorResponses` e precisam ser acrescentados.
- [ ] `[BE]` Acrescentar `isbn` ao enum do parâmetro `field` em `'/books/search'` (linha 366) e
      `isbn` ao `requestBody` de `POST /books` (linha 318).

### Documentação de projeto

- [ ] `[BE]` Em `.env.example`, documentar as seis variáveis novas em bloco comentado, no mesmo
      estilo das variáveis de segurança já presentes, deixando explícito que `GOOGLE_BOOKS_API_KEY`
      é **opcional** e que sem ela apenas a Open Library é usada (ADR 0001).
- [ ] `[BE]` No `README.md`, acrescentar as variáveis à tabela de ambiente e uma nota de que o
      lookup exige acesso de saída à internet — sem rede, o cadastro manual segue funcionando.
- [ ] `[BE]` Em `docs/guia-usuario.md`, acrescentar o passo "cadastrar exemplar pelo ISBN" na
      perspectiva do gestor.

## Frente FRONTEND

**Arquivos editados:** `frontend/src/app/core/models/book.model.ts`,
`frontend/src/app/core/services/book.service.ts`,
`frontend/src/app/features/admin/exemplares/exemplar-form/exemplar-form.{ts,html,css}`,
`frontend/src/app/features/admin/exemplares/exemplar-detail/exemplar-detail.html`,
`frontend/src/app/features/admin/exemplares/exemplares-list.{ts,html}`,
`frontend/src/app/features/usuario/catalogo/livro-detalhe/livro-detalhe.html`

### Models e service

- [ ] `[FE]` Em `book.model.ts`, aplicar exatamente o contrato de tipos: `Book` com os quatro campos
      novos como `| null` **não opcionais**, `BookMetadata` com `?:`, `BookFromIsbnResponse`,
      `CreateBookFromIsbnRequest`, e `isbn?: string` em `CreateBookRequest`.
- [ ] `[FE]` Em `book.service.ts`, acrescentar
      `lookupByIsbn(isbn: string): Observable<BookMetadata>` → `GET {baseUrl}/isbn/{isbn}` e
      `createFromIsbn(data: CreateBookFromIsbnRequest): Observable<BookFromIsbnResponse>` →
      `POST {baseUrl}/isbn`.
- [x] ~~`[FE]` **Corrigir `search()`**~~ — **já aplicado em 2026-08-05**, fora do escopo desta
      feature, porque o bug afetava quatro telas em produção e não só o cadastro por ISBN. Ver
      Divergências nº 1. `BookSearchParams` agora é `{ q: string; field?: BookSearchField }` e o
      tipo `BookSearchField` é compartilhado a partir de `book.model.ts`.
- [ ] `[FE]` Acrescentar `'isbn'` ao union `BookSearchField` em `book.model.ts` — é o único ponto
      do frontend que precisa mudar para a busca por ISBN, já que o transporte foi corrigido.

### Componente de formulário

- [ ] `[FE]` Em `exemplar-form.ts`, acrescentar `isbn: ['']` ao `fb.nonNullable.group` (linha 34) —
      **sem** `Validators.required`, porque o cadastro manual sem ISBN continua válido.
- [ ] `[FE]` Acrescentar os signals `lookingUp`, `lookupError` e `metadata`, no mesmo estilo dos
      signals já usados no componente (`saving`, `errorMessage`, `fieldErrors`).
- [ ] `[FE]` Implementar `lookupIsbn()`: chama `bookService.lookupByIsbn`, e no sucesso faz
      `form.patchValue({ title, author, description, isbn })` deixando os campos **editáveis** — o
      gestor revisa antes de salvar (ADR 0004).
- [ ] `[FE]` Tratar **cada** status da tabela de erros com `HttpErrorResponse` + `ApiError`, no
      padrão já usado em `submit()` (linha 91): 400 → "ISBN inválido, confira o número";
      404 → "ISBN não encontrado — preencha manualmente"; 429 → "Muitas consultas seguidas, aguarde";
      503 → "Serviço indisponível — preencha manualmente". **Nenhum desses casos pode bloquear o
      formulário manual.**
- [ ] `[FE]` Quando `alreadyRegistered` for `true`, exibir aviso via `ToastService` com link para
      `/admin/exemplares/{existingBookId}` em vez de duplicar o cadastro.
- [ ] `[FE]` Em `exemplar-form.html`, acrescentar o bloco "Buscar por ISBN" no topo do `<form>`
      (antes do `form-group` de `title`, linha 21), com input + botão `[disabled]="lookingUp()"`,
      spinner durante a consulta e preview de `coverUrl`. Reusar as classes existentes
      (`form-group`, `form-control`, `btn btn--secondary`, `banner banner--info`).
- [ ] `[FE]` Estender `fieldInvalid()` (linha 121) para aceitar `'isbn'` no union de nomes.

### Demais telas

- [ ] `[FE]` Em `exemplar-detail.html`, acrescentar um `info-item` "ISBN" ao `info-grid` (linha 22)
      com `@if (b.isbn)`, e a capa (`@if (b.coverUrl)`) ao lado do `page-header`.
- [ ] `[FE]` Em `exemplares-list.html`, acrescentar `<option value="isbn">Buscar por ISBN</option>`
      ao select (linha 18). O `exemplares-list.ts` **não precisa de mudança**: ele já consome o
      `BookSearchField` compartilhado, então acrescentar `'isbn'` ao union em `book.model.ts` basta.
- [ ] `[FE]` Em `livro-detalhe.html` (catálogo do leitor), exibir a capa quando `coverUrl` existir —
      é a tela onde a capa tem mais valor para o usuário final.

### Roteamento e navegação

- [ ] `[FE]` **Sem mudança.** A feature vive dentro de `admin/exemplares/novo`, rota já protegida por
      `authGuard` + `roleGuard('MANAGER')` em `app.routes.ts:29`. Nenhum item de menu novo.

## Sequência de execução

| # | Frente | Tarefa | Depende de | Paralelizável |
|---|---|---|---|---|
| 1 | DB | Schema + migração + `db:generate` + seed | — | não |
| 2 | BE | `src/utils/isbn.ts` + `tests/isbn.test.ts` | — | sim, com 1 |
| 3 | BE | Envs em `config/env.ts` + `types/isbn.ts` | — | sim, com 1 e 2 |
| 4 | BE | Providers + `isbnLookup.service` + `tests/isbnLookup.test.ts` | 2, 3 | não |
| 5 | BE | Repositório + schemas Zod | 1 | sim, com 4 |
| 6 | BE | `book.service` (dedup, preview, createFromIsbn) | 4, 5 | não |
| 7 | BE | Controller + rate limiter + rotas | 6 | não |
| 8 | BE | `tests/books-isbn.test.ts` | 7 | não |
| 9 | BE | OpenAPI + `.env.example` + README + guia | 7 | sim, com 8 |
| 10 | FE | Models + service (inclui o fix de `search`) | **contratos** | sim, a partir do início |
| 11 | FE | `exemplar-form` (bloco de busca + estados) | 10 | não |
| 12 | FE | `exemplar-detail`, `exemplares-list`, `livro-detalhe` | 10 | sim, com 11 |

Fechados os contratos, a frente FRONTEND (10-12) roda em paralelo com toda a BACKEND — só a
validação manual final precisa das duas prontas.

## Riscos e mitigações

| Risco | Probabilidade | Mitigação concreta |
|---|---|---|
| Rotas `/isbn/...` registradas depois de `GET /:id` → 404 silencioso | **Alta** | Registrar entre as linhas 12 e 13 de `src/routes/books.ts` e cobrir com o teste de regressão de roteamento em `tests/books-isbn.test.ts` |
| Teste tocando a rede real (lento, flaky, dependente de terceiro) | Alta | `vi.stubGlobal('fetch', vi.fn())` em **todo** teste que chama o service; `clearCache()` no `beforeEach` |
| Cache vazando estado entre casos de teste | Alta | `isbnLookupService.clearCache()` exportado desde o início, não como remendo depois |
| Migração recriando a tabela `books` no SQLite | Média | Inspecionar o SQL gerado antes de aplicar; abortar se aparecer `new_books`/`INSERT INTO … SELECT`. Todas as colunas nulas evitam o rebuild |
| `description` vazia reprovando no `min(1)` do Zod | Média | Fallback sintetizado obrigatório no provider (ADR 0004), com teste dedicado do caminho "Work sem descrição" |
| Tipar `isbn?: string` no `Book` do frontend enquanto o Prisma devolve `null` | Média | Contrato de tipos fixa `string \| null` obrigatório; a nota de coerência explica o porquê |
| Rate limiter derrubando a suíte de testes | Média | `skip: () => env.NODE_ENV === 'test'`, como no `authRateLimiter`; `tests/setup.ts` já força `NODE_ENV=test` |
| ISBN nacional ausente na Open Library | Média | 404 tratado na UI como "preencha manualmente"; fallback opcional do Google Books via chave (ADR 0001) |
| Latência de até 2 requisições externas por lookup | Baixa | `AbortSignal.timeout(5000)` + cache com TTL de 24h; a chamada do Work é best-effort |
| Open Library bloqueando por User-Agent genérico | Baixa | Header `User-Agent: BiblioFlow/1.0 (+github.com/elias-mb3/biblioflow)` em todas as chamadas |

## Critérios de aceite

- [ ] `npm run lint` sem warnings
- [ ] `npm test` verde, incluindo `auth`, `books`, `rentals`, `users` e `security` já existentes
- [ ] `cd frontend && npm run build` sem erro
- [ ] Nenhum teste faz requisição de rede real (rodar com a máquina offline deve passar)
- [ ] `docker compose up --build` e, pelo painel do gestor, cadastrar `9788535902778` por ISBN:
      título "A ditadura envergonhada", autor "Elio Gaspari", capa exibida, `registrationCode`
      gerado, livro aparecendo na listagem e na busca por ISBN
- [ ] Repetir o mesmo ISBN e confirmar que o estoque foi somado, sem criar um segundo registro
- [ ] `GET /books/{id}` de um livro existente continua respondendo 200
- [ ] `/api-docs` exibindo `GET /books/isbn/{isbn}` e `POST /books/isbn` com exemplos
- [ ] Subir com `ISBN_LOOKUP_ENABLED=false` e confirmar 503 no lookup **e** cadastro manual intacto
- [ ] ADRs 0001-0004 em `docs/adr/` e índice `docs/adr/README.md` atualizado
- [ ] Entrada acrescentada em `changelog/CHANGELOG.md`

## Divergências encontradas na auditoria

1. **Bug pré-existente — nenhuma busca de livros do SPA filtrava nada. ✅ CORRIGIDO em 2026-08-05.**
   `book.service.ts#search()` enviava `?title=Quixote&page=1`, mas o backend
   (`bookSearchSchema`, `src/schemas/book.ts:17`) só lê `q`, `field` e `page`. Com `q` chegando
   `undefined`, `bookRepository.search` montava `where = {}` e **devolvia o acervo inteiro**,
   ignorando o termo digitado. Não era incompatibilidade de nomes: a busca aparentava funcionar e
   retornava resultado errado.

   O alcance era maior do que a primeira leitura sugeria — **quatro** call sites, não um:

   | Tela | Arquivo | Efeito |
   |---|---|---|
   | Gestor — lista de exemplares | `exemplares-list.ts:65` | Seletor título/autor/código sem efeito |
   | Gestor — autocomplete de "Nova locação" | `locacao-form.ts:72` | Sugeria os 10 primeiros livros do acervo, não os que casam |
   | Leitor — catálogo | `catalogo.ts:54` | Busca do catálogo sem efeito |
   | Leitor — autocomplete de doação | `doacoes.ts:53` | Mesma falha da locação |

   O autocomplete de locação é justamente o que `docs/PLANO_MELHORIAS.md` cita como padrão de
   referência para busca no frontend, o que faz do bug um problema de demo, não só de UX.

   **Correção aplicada, independente desta feature:** `BookSearchParams` passou a ser
   `{ q: string; field?: BookSearchField }`, espelhando o contrato da API; `BookService.search`
   envia `q` + `field`; os quatro call sites passaram a mandar `{ q, field: 'title' }` — as quatro
   telas são rotuladas "por título", então o comportamento visível não muda, só passa a funcionar.
   O union `SearchField`, que estava duplicado em `exemplares-list.ts:17`, foi substituído pelo
   `BookSearchField` compartilhado em `book.model.ts` — **a duplicação era o que permitia os dois
   lados divergirem**. `UserService.search` já estava correto e não foi tocado.

   Verificado: `cd frontend && npm run build` e `npm test` (46 testes) verdes. O contrato correto
   já era coberto pelo backend em `tests/books.test.ts` ("searches by title", usando
   `?q=Quixote&field=title`) — o frontend é que não o usava.

2. **O plano de discovery deixou em aberto onde ficariam as novas variáveis de ambiente**
   ("`src/config/isbn.ts` ou adicionar em `src/config/env.ts`"). Resolvido: **`src/config/env.ts`**,
   porque o helper `parseBool` (linha 13) é local ao módulo e não é exportado — um arquivo separado
   teria que duplicá-lo.

3. **O discovery não mencionou o catálogo do leitor.** Existe uma segunda superfície que exibe
   livros (`frontend/src/app/features/usuario/catalogo/`), fora do painel do gestor. A capa foi
   acrescentada ao escopo do frontend porque é justamente onde ela tem mais valor.

4. **`clearCache()` não estava previsto no discovery.** Sem ele, o cache do
   `isbnLookup.service` sobrevive entre casos de teste e `fileParallelism: false`
   (`vitest.config.ts`) faz os arquivos rodarem em sequência no mesmo processo — os testes passariam
   ou falhariam conforme a ordem.

5. **Não é divergência, é confirmação:** a preocupação com `@unique` sobre dado legado se dissolve.
   O repositório já tem o precedente exato — `users.cpf` é `String? @unique` com múltiplos gestores
   de `cpf` nulo. Nenhum backfill é necessário.

## Fora do escopo

Herdado do discovery:

- Leitor de código de barras pela câmera (ZXing/`html5-qrcode`) — exige dependência de frontend e
  HTTPS para permissão de câmera. É o próximo ganho de usabilidade, agora destravado pelo backend.
- Importação em lote de ISBNs — o projeto não tem infra de filas.
- Cache persistente dos metadados em tabela SQLite — o cache em memória basta para o volume atual.
- `category`/tags e o restante da Fase 5 de `docs/PLANO_MELHORIAS.md`.

Decidido nesta auditoria:

- **Não** exibir capa na listagem em tabela de `exemplares-list.html`: a tabela tem 5 colunas e uma
  miniatura por linha degradaria a leitura. Capa só nas telas de detalhe e no formulário.
- **Não** criar índice em `publisher` ou `publishedYear`: nenhum filtro previsto usa esses campos.
- **Não** migrar os livros já cadastrados para buscar ISBN retroativamente por título/autor — a
  correspondência por título é imprecisa e gravaria ISBN errado numa coluna única.
