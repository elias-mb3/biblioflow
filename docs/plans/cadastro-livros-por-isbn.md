# Plano de implementação: Cadastro de livros por ISBN

## Contexto

Hoje o gestor cadastra cada exemplar digitando título, autor, descrição e quantidade à mão
(`POST /api/v1/books` + tela `exemplar-form`). Esta feature permite informar um **ISBN**, buscar os
metadados do livro numa base pública gratuita e pré-preencher/criar o exemplar automaticamente,
reduzindo o esforço de digitalização do acervo da IPB. O ISBN também passa a ser persistido no
`Book`, virando chave natural de deduplicação (evita cadastrar o mesmo título duas vezes em vez de
incrementar `quantity`) e critério de busca. O escopo cobre backend (Prisma + camadas + OpenAPI +
testes) e frontend Angular (campo ISBN com botão "Buscar dados"), seguindo o que já existe no repo.

**Decisões técnicas:**

- **Open Library como provedor primário**, via `GET https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data` — **não exige API key**, é gratuita e sem cadastro, e foi verificada ao vivo durante este discovery retornando `title`, `authors[].name`, `publishers[].name`, `publish_date`, `number_of_pages` e `cover.{small,medium,large}`. Encaixa no requisito "preferência para APIs gratuitas" e no self-hosting do projeto (nenhum segredo novo obrigatório).
- **Google Books apenas como fallback opcional, atrás de `GOOGLE_BOOKS_API_KEY`** — verificado neste discovery que a chamada anônima a `https://www.googleapis.com/books/v1/volumes?q=isbn:...` hoje responde **HTTP 429** (`quota_limit_value: "0"` para projeto anônimo), e a doc oficial afirma que "a request that does not provide an OAuth 2.0 token must send an API key". Logo, sem chave ela não é utilizável; o fallback fica **desligado por padrão** e só é acionado se a env estiver preenchida.
- **Descrição vem de uma 2ª chamada ao Work da Open Library** (`GET /works/{key}.json` → campo `description`, que pode ser `string` ou `{ type, value }`) — o `jscmd=data` **não retorna descrição**, e `Book.description` é `String` obrigatório no schema atual. Se o Work não tiver descrição, cai num texto sintetizado a partir de editora/ano/páginas, nunca string vazia (o Zod exige `min(1)`).
- **Validação de ISBN com a lib [`isbn3`](https://www.npmjs.com/package/isbn3)** (v2.0.10, **zero dependências**, com `isbn.d.ts` próprio) — faz parse, validação de dígito verificador, normalização (remove hífens/espaços) e conversão ISBN-10 ↔ ISBN-13. Evita reimplementar mod-11/mod-10 à mão e cobre casos de borda (dígito `X`, prefixos `ISBN:`). O ISBN é **normalizado para ISBN-13 sem hífens** antes de persistir, para que a coluna `@unique` case corretamente.
- **Lookup separado da criação**: `GET /books/isbn/:isbn` (consulta, não persiste) + `POST /books/isbn` (consulta e cria). O primeiro alimenta o preenchimento do formulário no Angular; o segundo é o atalho de "1 clique / leitor de código de barras". Ambos 👤 `MANAGER`, como todo o resto de escrita de acervo.
- **Cache em memória com TTL + rate limiter dedicado** nas rotas de lookup, reusando a fábrica `createRateLimiter` de `src/middlewares/rateLimit.ts`. A Open Library pede uso moderado, cache dos resultados e `User-Agent` descritivo — o cliente envia `User-Agent: BiblioFlow/1.0 (+github.com/elias-mb3/biblioflow)`.
- **Timeout explícito de 5s** com `AbortSignal.timeout()` no `fetch` global do Node 20 — sem adicionar axios/node-fetch como dependência.
- Alinhado à **Fase 5 do `docs/PLANO_MELHORIAS.md`** ("Catálogo: `isbn`, `category`/tags, `coverUrl`"), antecipando a parte de `isbn`/`coverUrl`.

**Stack e convenções relevantes do projeto:**

- Node 20 + TypeScript + Express 5, camadas `routes → controllers → services → repositories`; repositório é a **única** camada que fala com o Prisma.
- **Identificadores em inglês, mensagens/UI/commits em português** — é o que o código faz de fato (ver "Convenções confirmadas" em `docs/PLANO_MELHORIAS.md`), apesar do texto do `CLAUDE.md`.
- Erro padrão `{ erro, detalhes }` via `AppError` (`src/utils/errors.ts`) + `errorHandler`; validação de body por `validate(schema)` (`src/middlewares/validate.ts`); paginação `{ items, total, page, pages }`.
- Testes: Vitest + Supertest contra **banco SQLite real e descartável** (`tests/setup.ts`, `fileParallelism: false`), helpers em `tests/helpers.ts` (`createManagerAndLogin`, `createUserAndLogin`, `seedBook`).
- OpenAPI escrito à mão em `src/docs/openapi.ts` (schemas reutilizáveis + `paths`), servido em `/api-docs`.
- Frontend Angular 20 standalone com signals; serviços em `frontend/src/app/core/services/`, features do gestor em `frontend/src/app/features/admin/`.

> ⚠️ **Atenção à ordem das rotas**: em `src/routes/books.ts` o `GET /:id` é declarado depois de `GET /search`. As novas rotas `/isbn/...` **precisam** ser registradas antes de `GET /:id`, senão `/books/isbn/9788535902778` cai no handler de `getById` e retorna 404.

---

## Checklist de implementação

### 1. Modelagem de dados

- [ ] Em `prisma/schema.prisma`, adicionar ao model `Book`: `isbn String? @unique`, `coverUrl String?`, `publisher String?`, `publishedYear Int?`. Manter `registrationCode` como identificador interno (o ISBN não o substitui).
- [ ] Gerar a migração: `npm run db:migrate -- --name add_isbn_to_book` e conferir o SQL gerado em `prisma/migrations/`. **Não** editar o banco à mão.
- [ ] Rodar `npm run db:generate` e confirmar que `src/generated/prisma/models/Book.ts` reflete os campos novos (arquivo gerado — nunca editar manualmente).
- [ ] Atualizar `prisma/seed.ts` para incluir `isbn` em pelo menos um livro semeado (ISBN real, ex. `9788535902778`), validando o caminho feliz na demo.

### 2. Utilitário de ISBN

- [ ] Instalar a dependência: `npm i isbn3`.
- [ ] Criar `src/utils/isbn.ts` exportando:
  - `normalizeIsbn(raw: string): string | null` — usa `ISBN.parse()` do `isbn3`; retorna o **ISBN-13 sem hífens** (`isbn13` do objeto parseado) ou `null` se inválido.
  - `isValidIsbn(raw: string): boolean` — atalho sobre `normalizeIsbn`.
- [ ] Criar `tests/isbn.test.ts` (teste unitário puro, sem banco) cobrindo: ISBN-13 válido com e sem hífens; ISBN-10 válido convertido para ISBN-13; ISBN-10 terminado em `X`; entrada com prefixo `ISBN:`; dígito verificador errado → `null`; string vazia/lixo → `null`.

### 3. Cliente de metadados (integração externa)

- [ ] Adicionar ao objeto `env` em **`src/config/env.ts`** as variáveis: `ISBN_LOOKUP_ENABLED` (default `true`), `ISBN_LOOKUP_TIMEOUT_MS` (default `5000`), `ISBN_CACHE_TTL_MS` (default `86400000` = 24h), `ISBN_NOT_FOUND_CACHE_TTL_MS` (default `3600000` = 1h), `GOOGLE_BOOKS_API_KEY` (default `''`), `ISBN_LOOKUP_RATE_LIMIT_MAX` (default `30`). Usar `parseBool`/`parseInt` como já é feito no arquivo. **Resolvido na auditoria técnica:** não criar um `src/config/isbn.ts` separado, porque o helper `parseBool` (`src/config/env.ts:13`) é local ao módulo e não é exportado — um arquivo novo teria que duplicá-lo.
- [ ] Criar `src/types/isbn.ts` com a interface `BookMetadata`: `{ isbn: string; title: string; author: string; description: string; publisher?: string; publishedYear?: number; coverUrl?: string; source: 'openlibrary' | 'googlebooks' }`.
- [ ] Criar `src/services/providers/openLibrary.provider.ts`:
  - [ ] `fetchByIsbn(isbn13: string): Promise<BookMetadata | null>` chamando `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn13>&format=json&jscmd=data` com header `User-Agent: BiblioFlow/1.0 (+github.com/elias-mb3/biblioflow)` e `signal: AbortSignal.timeout(ISBN_LOOKUP_TIMEOUT_MS)`.
  - [ ] Tratar **não encontrado**: corpo `{}` ou chave `ISBN:<isbn13>` ausente → retornar `null` (não lançar).
  - [ ] Mapear: `title`; `author` = `authors.map(a => a.name).join(', ')` (fallback `'Autor não informado'` quando ausente); `publisher` = `publishers[0]?.name`; `publishedYear` = 4 dígitos extraídos de `publish_date` via regex (o campo é texto livre, ex. `"2002"`, `"October 1, 1988"`); `coverUrl` = `cover.large ?? cover.medium ?? cover.small`.
  - [ ] Buscar a descrição numa 2ª chamada a `https://openlibrary.org/works/{workKey}.json` (a chave do Work vem de `search.json?isbn=<isbn13>&fields=key&limit=1`, ou de `/books/{olid}.json → works[0].key`). Normalizar `description` que pode ser `string` **ou** `{ type, value }`. Falha/timeout nessa 2ª chamada **não** invalida o resultado — apenas cai no fallback.
  - [ ] Fallback de descrição quando o Work não tiver: `"<title>, de <author>. Editora <publisher>, <ano>. <n> páginas."` montado com o que existir — nunca string vazia.
- [ ] Criar `src/services/providers/googleBooks.provider.ts` com a mesma assinatura, chamando `https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn13>&key=<GOOGLE_BOOKS_API_KEY>`, mapeando `items[0].volumeInfo` (`title`, `authors`, `description`, `publisher`, `publishedDate`, `imageLinks.thumbnail`). **Retornar `null` imediatamente se `GOOGLE_BOOKS_API_KEY` estiver vazia** — sem chave a API responde 429.
- [ ] Criar `src/services/isbnLookup.service.ts`:
  - [ ] Cache em memória `Map<string, { data: BookMetadata | null; expiresAt: number }>` com TTL `ISBN_CACHE_TTL_MS`, cacheando também o "não encontrado" (TTL menor, ex. 1h) para não repetir chamadas.
  - [ ] `lookup(rawIsbn: string): Promise<BookMetadata>`: normaliza (400 `'ISBN inválido'` se `null`); consulta cache; tenta Open Library; se `null`, tenta Google Books; se ambos falharem, lança `AppError('Livro não encontrado para o ISBN informado', 404)`.
  - [ ] Erro de rede/timeout dos provedores → `AppError('Serviço de consulta de ISBN indisponível. Tente novamente ou cadastre manualmente.', 503)`, com `console.error` do erro original (mesmo estilo do `errorHandler`).
  - [ ] Respeitar `ISBN_LOOKUP_ENABLED=false` → `AppError('Consulta por ISBN desabilitada', 503)`.
  - [ ] Exportar `clearCache()`. **Obrigatório, não opcional:** `vitest.config.ts` usa `fileParallelism: false`, então os arquivos de teste rodam em sequência no mesmo processo e o cache em memória sobrevive entre eles — sem uma forma de limpá-lo no `beforeEach`, os testes passam ou falham conforme a ordem de execução.
- [ ] Criar `tests/isbnLookup.test.ts` **sem rede real**, usando `vi.stubGlobal('fetch', vi.fn())` (padrão Vitest, já disponível via `globals: true`): resposta OK da Open Library → metadata mapeada; corpo `{}` → 404; `AbortError`/timeout → 503; segunda chamada idêntica **não** dispara `fetch` de novo (cache); com `GOOGLE_BOOKS_API_KEY` vazia o provider do Google não é chamado.

### 4. Camada de repositório e serviço de livros

- [ ] Em `src/repositories/book.repository.ts`: adicionar `findByIsbn(isbn: string)` (`prisma.book.findUnique({ where: { isbn } })`) e `incrementQuantity(id: string, by: number)` (`prisma.book.update({ where: { id }, data: { quantity: { increment: by } } })`).
- [ ] Em `src/repositories/book.repository.ts`, incluir `isbn` no `OR` da busca genérica de `search()` (junto de `title`/`author`/`registrationCode`) e aceitar `'isbn'` como `field`.
- [ ] Em `src/schemas/book.ts`:
  - [ ] Adicionar `isbn: z.string().optional()` a `createBookSchema` e `updateBookSchema`, com `.refine(isValidIsbn)` e mensagem `'ISBN inválido'`.
  - [ ] Adicionar `'isbn'` ao `z.enum` de `bookSearchSchema.field`.
  - [ ] Criar `isbnParamSchema = z.object({ isbn: z.string().min(10) })` e `createBookFromIsbnSchema = z.object({ isbn: z.string(), quantity: z.number().int().positive().default(1) })`.
- [ ] Em `src/services/book.service.ts`:
  - [ ] Em `create()`, normalizar `input.isbn` (quando presente) e rejeitar duplicata com `AppError('Já existe um livro cadastrado com este ISBN', 409)` — mesmo estilo do 409 já usado em `delete()`.
  - [ ] Em `update()`, aplicar a mesma normalização/checagem, ignorando o próprio registro.
  - [ ] `previewByIsbn(rawIsbn)`: chama `isbnLookupService.lookup()` e devolve `{ ...metadata, alreadyRegistered: boolean, existingBookId?: string }` consultando `bookRepository.findByIsbn` — o frontend usa isso para avisar antes de duplicar.
  - [ ] `createFromIsbn({ isbn, quantity })`: faz o lookup e cria o `Book` com `registrationCode` gerado por `generateRegistrationCode()` (o código de registro **continua interno e imutável**; o ISBN nunca o substitui). Se o ISBN já existir no acervo, **incrementar `quantity`** e devolver o livro existente com flag `{ incremented: true }` — comportamento mais útil que um 409 para acervo comunitário com exemplares repetidos.
- [ ] Adicionar teste de regra de negócio ao serviço dentro de `tests/books.test.ts` (ou novo `tests/books-isbn.test.ts`), seguindo o padrão de integração do repo.

### 5. Controller e rotas

- [ ] Em `src/controllers/book.controller.ts`, adicionar `previewByIsbn` e `createFromIsbn`, no mesmo formato dos handlers existentes (`try/catch` + `next(err)`), validando o parâmetro de rota com `isbnParamSchema.safeParse(req.params)` e devolvendo `{ erro: 'Parâmetros inválidos', detalhes }` em 400 — igual ao que `search` já faz.
- [ ] Criar `isbnLookupRateLimiter` em `src/middlewares/rateLimit.ts` usando `createRateLimiter({ limit: env.ISBN_LOOKUP_RATE_LIMIT_MAX, skip: () => env.NODE_ENV === 'test' })` — o `skip` em test é obrigatório para não flakear a suíte, como já feito no `authRateLimiter`.
- [ ] Em `src/routes/books.ts`, registrar **antes** de `GET /:id`:
  - `booksRouter.get('/isbn/:isbn', requireRole('MANAGER'), isbnLookupRateLimiter, bookController.previewByIsbn)`
  - `booksRouter.post('/isbn', requireRole('MANAGER'), isbnLookupRateLimiter, validate(createBookFromIsbnSchema), bookController.createFromIsbn)`
- [ ] Criar `tests/books-isbn.test.ts` com `vi.stubGlobal('fetch', ...)` e o padrão de `tests/books.test.ts` (`beforeEach` limpando tabelas + `createManagerAndLogin`/`createUserAndLogin`):
  - [ ] `GET /books/isbn/:isbn` com ISBN válido → 200 com `title`/`author`/`isbn` normalizado.
  - [ ] ISBN com dígito verificador errado → 400 `'ISBN inválido'`.
  - [ ] ISBN não encontrado no provedor → 404.
  - [ ] Provedor fora do ar (fetch rejeita) → 503, e a mensagem sugere cadastro manual.
  - [ ] `POST /books/isbn` → 201 com `registrationCode` gerado e `isbn` persistido.
  - [ ] `POST /books/isbn` repetido com o mesmo ISBN → `quantity` incrementado, e **não** cria um segundo `Book`.
  - [ ] `POST /books` manual com `isbn` já existente → 409.
  - [ ] Proteção: 401 sem token e 403 com token de `USER` nas duas rotas novas.
  - [ ] Regressão: `GET /books/:id` continua funcionando (garante que `/isbn/...` não capturou a rota).

### 6. Documentação da API

- [ ] Em `src/docs/openapi.ts`: adicionar `isbn`, `coverUrl`, `publisher`, `publishedYear` ao `bookSchema`; criar `bookMetadataSchema`; documentar `GET /books/isbn/{isbn}` (200/400/404/503) e `POST /books/isbn` (201/400/404/503), ambos com `security` bearer e nota de que exigem `MANAGER`.
- [ ] Em `.env.example`, documentar `ISBN_LOOKUP_ENABLED`, `ISBN_LOOKUP_TIMEOUT_MS`, `ISBN_CACHE_TTL_MS`, `ISBN_LOOKUP_RATE_LIMIT_MAX` e `GOOGLE_BOOKS_API_KEY` (comentando que é **opcional** e que sem ela só a Open Library é usada), no mesmo estilo comentado das variáveis de segurança já presentes.
- [ ] No `README.md`, adicionar à tabela de variáveis de ambiente as novas envs e uma nota curta: a API requer acesso de saída à internet para o lookup; sem rede, o cadastro manual continua funcionando normalmente.
- [ ] Atualizar `docs/guia-usuario.md` com o passo "cadastrar exemplar pelo ISBN" na perspectiva do gestor.

### 7. Frontend (Angular)

- [ ] Em `frontend/src/app/core/models/book.model.ts`: adicionar `isbn?`, `coverUrl?`, `publisher?`, `publishedYear?` a `Book` e a `CreateBookRequest`; criar `BookMetadata` (espelhando o tipo do backend) com `alreadyRegistered: boolean` e `existingBookId?: string`.
- [ ] Em `frontend/src/app/core/services/book.service.ts`: adicionar `lookupByIsbn(isbn: string): Observable<BookMetadata>` (`GET {baseUrl}/isbn/{isbn}`) e `createFromIsbn(isbn: string, quantity: number): Observable<Book>` (`POST {baseUrl}/isbn`).
- [ ] Em `frontend/src/app/features/admin/exemplares/exemplar-form/exemplar-form.{ts,html}`:
  - [ ] Adicionar o controle `isbn` ao `fb.nonNullable.group` (opcional, sem `Validators.required`) e um bloco "Buscar por ISBN" no topo do formulário, com input + botão.
  - [ ] Signals `lookingUp`, `lookupError`, `metadata` seguindo o estilo dos signals já usados no componente (`saving`, `errorMessage`, `fieldErrors`).
  - [ ] Ao buscar com sucesso: `form.patchValue({ title, author, description, isbn })` deixando os campos **editáveis** (gestor revisa antes de salvar) e exibir a capa (`coverUrl`) como preview.
  - [ ] Se `alreadyRegistered` for `true`, mostrar aviso via `ToastService` com link para `/admin/exemplares/{existingBookId}` em vez de duplicar.
  - [ ] Tratar 404 ("ISBN não encontrado — preencha manualmente") e 503 ("serviço indisponível — preencha manualmente") sem bloquear o cadastro manual, usando o padrão `HttpErrorResponse` + `ApiError` já presente no `submit()`.
- [ ] Em `frontend/src/app/features/admin/exemplares/exemplar-detail/exemplar-detail.html`: exibir ISBN e capa quando existirem. Na `exemplares-list.html`, acrescentar apenas a opção "Buscar por ISBN" ao select — **sem** miniatura de capa, que degradaria a leitura de uma tabela de 5 colunas.
- [ ] **Segunda superfície, não prevista na primeira leitura:** o catálogo do leitor (`frontend/src/app/features/usuario/catalogo/`) também exibe livros, fora do painel do gestor. Exibir a capa em `livro-detalhe.html` — é a tela onde ela tem mais valor para o usuário final.

### 8. Integração e validação final

- [ ] Rodar `npm run lint` na raiz e corrigir até zero warnings.
- [ ] Rodar `npm test` e confirmar que **toda** a suíte existente (`auth`, `books`, `rentals`, `users`, `security`) continua verde além dos testes novos.
- [ ] Rodar `cd frontend && npm run build` para garantir que o build Angular não quebrou.
- [ ] Subir com `docker compose up --build` e validar manualmente: cadastrar um exemplar por ISBN real (ex. `9788535902778` — "A ditadura envergonhada", Elio Gaspari, Companhia das Letras), conferir `registrationCode` gerado, capa exibida e o livro aparecendo na listagem e na busca.
- [ ] Conferir `/api-docs` mostrando as duas rotas novas com exemplos.
- [ ] Commit em Conventional Commits (PT), na branch da feature — ex.: `feat(livros): permite cadastro de exemplares a partir do ISBN`.

---

## Fora do escopo inicial

- **Leitor de código de barras pela câmera** (ZXing/`html5-qrcode` no Angular): é o próximo ganho grande de usabilidade para digitalizar o acervo, mas adiciona dependência de frontend e permissão de câmera (exige HTTPS). Fica para uma iteração seguinte, agora que o backend já aceita ISBN.
- **Importação em lote** (CSV/lista de ISBNs com job assíncrono) — o projeto não tem infra de filas hoje.
- **Cache persistente dos metadados** (tabela `IsbnCacheEntry` no SQLite): o cache em memória basta para o volume esperado; vira necessário só se a API for reiniciada com frequência.
- **`category`/tags e mais campos de catálogo** — restante da Fase 5 do `docs/PLANO_MELHORIAS.md`.
- ~~**Bug pré-existente:** `book.service.ts#search()` envia `title`/`author`/`registrationCode`, mas o backend espera `q` + `field`.~~ → **Corrigido em 2026-08-05**, fora desta feature. A auditoria técnica confirmou que o efeito era pior que "ignora o filtro": as buscas **devolviam o acervo inteiro** aparentando funcionar, e o problema atingia **quatro** telas (lista de exemplares, autocomplete de nova locação, catálogo do leitor e autocomplete de doação) — não só o painel. Detalhes em [`cadastro-livros-por-isbn.impl.md`](./cadastro-livros-por-isbn.impl.md#divergências-encontradas-na-auditoria).

## Referências usadas na pesquisa

- [Open Library Books API](https://openlibrary.org/api/books?bibkeys=ISBN:9788535902778&format=json&jscmd=data) — endpoint primário; **verificado ao vivo neste discovery**: responde sem API key e traz título, autores, editora, ano, páginas e URLs de capa.
- Open Library Works API (`https://openlibrary.org/works/{key}.json`) — **verificado ao vivo**: única fonte da descrição (campo `description`, `string` ou `{ type, value }`), ausente no `jscmd=data`.
- [Google Books API — Using the API](https://developers.google.com/books/docs/v1/using) — sintaxe `q=isbn:`; a doc afirma que requisições sem OAuth precisam de API key. **Verificado ao vivo**: chamada anônima retorna 429 com `quota_limit_value: "0"` — daí a decisão de tratá-la como fallback opcional.
- [Open Library API: Free Book & ISBN Lookup, No Key — FreeAPIHub](https://freeapihub.com/apis/open-library) — política de uso: sem rate limit formal, mas pede cache, uso moderado e `User-Agent` descritivo (requisições com UA genérico/ausente podem ser bloqueadas).
- [The Best Book API Options for Developers in 2026 — API League](https://apileague.com/articles/book-apis/) — comparativo de custo/limites entre Open Library e Google Books, base da escolha do provedor primário.
- [`isbn3` no npm](https://www.npmjs.com/package/isbn3) — v2.0.10, zero dependências, tipagem TS inclusa; parse, validação, formatação e conversão ISBN-10 ↔ ISBN-13.
- [ISBN Validation Algorithm: Handling Edge Cases in TypeScript — SitePoint](https://www.sitepoint.com/isbn-validation-typescript-algorithm-edge-cases/) — casos de borda que os testes de `src/utils/isbn.ts` devem cobrir (dígito `X`, hífens, prefixos, variantes Unicode).
- `docs/PLANO_MELHORIAS.md` (Fase 5) — a feature antecipa os itens `isbn` e `coverUrl` já previstos no roadmap do projeto.
