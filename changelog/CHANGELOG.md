# Changelog

## [Unreleased]

No pending unreleased changes — all work is committed to `prod`.

---

## Project Overview

**BiblioFlow** is a community library management system built for Igreja Presbiteriana do Brasil (IPB)
as a university extension project (UNASP — Análise e Desenvolvimento de Sistemas). The system
digitalises and manages a community book collection: registering books, controlling rentals (loans
and returns), and accepting donations.

The project now consists of a **full-stack application**: a REST API backend and an Angular SPA frontend,
both containerised with Docker.

**Full tech stack:**

| Layer | Technology |
|---|---|
| Backend language | TypeScript (strict mode) |
| Backend runtime | Node.js 20 LTS |
| HTTP Framework | Express 5 |
| Database | SQLite — single file, Docker-volume-persisted |
| ORM | Prisma 7 + `@prisma/adapter-better-sqlite3` |
| Validation | Zod 4 |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Tests | Vitest 4 + Supertest |
| API Docs | swagger-ui-express + OpenAPI 3.0 |
| Backend code quality | ESLint + Prettier |
| Frontend framework | Angular 20 (standalone components) |
| Frontend language | TypeScript 5.9 |
| Frontend styling | Pure CSS — custom properties, no CSS framework |
| Frontend state | Angular Signals (`signal`, `computed`, `effect`) |
| Frontend forms | Angular Reactive Forms |
| Frontend HTTP | `HttpClient` + functional interceptors |
| Containerisation | Docker + Docker Compose (API + Angular/Nginx) |

---

## Architecture

### Backend — `routes → controllers → services → repositories`

| Layer | Responsibility |
|---|---|
| `src/routes/` | Express router definitions; mount middleware, call controllers |
| `src/controllers/` | Parse HTTP request, call the service, return the response — no business logic |
| `src/services/` | All domain rules and business logic — single source of truth |
| `src/repositories/` | All database queries — no Prisma calls outside this layer |

Supporting directories:

- **`src/config/`** — `env.ts` (typed env vars) and `database.ts` (Prisma singleton).
- **`src/middlewares/`** — `authenticate`, `requireRole`, `validate`, `errorHandler`.
- **`src/schemas/`** — Zod schemas per resource; used by `validate` middleware.
- **`src/docs/`** — `openapi.ts`: full OpenAPI 3.0 spec served by `swagger-ui-express`.
- **`src/types/`** — Shared TypeScript interfaces (`AuthRequest`, `AuthPayload`).
- **`src/utils/`** — `AppError` class and `generateRegistrationCode` helper.

### Frontend — Angular feature-shell architecture

```
frontend/src/app/
├── core/
│   ├── guards/         auth.guard.ts, role.guard.ts
│   ├── interceptors/   auth.interceptor.ts
│   ├── models/         user, book, rental, donation, api-error, pagination
│   └── services/       auth, book, rental, donation, toast
├── shared/
│   └── components/     toast, modal, pagination, spinner, empty-state
├── features/
│   ├── auth/           login, register-gestor, register-usuario
│   ├── admin/          admin-shell, dashboard, exemplares, locacoes, perfil
│   └── usuario/        usuario-shell, catalogo, livro-detalhe, doacoes
└── app.routes.ts       lazy-loaded with canActivate guards
```

All components are **standalone** (no NgModules). State is managed via **Angular Signals**. Dependency
injection uses the functional `inject()` API. Route protection uses functional guards (`authGuard`,
`roleGuard`).

---

## Key Architectural Decisions

### Backend

**1. `AppError` for controlled HTTP errors**
`src/utils/errors.ts` defines `AppError(message, statusCode, details?)`. Services throw `AppError`;
the global `errorHandler` middleware catches it and serialises to `{ "erro": "...", "detalhes": [...] }`.

**2. Prisma 7 adapter pattern**
Prisma 7 no longer reads `DATABASE_URL` automatically. The runtime client is constructed with an
explicit `PrismaBetterSqlite3` driver adapter in `src/config/database.ts`. `prisma.config.ts` is
used by the CLI only (migrations, generate).

**3. Prisma singleton via `globalThis`**
To avoid multiple DB connections during hot-reload, the Prisma client is cached on `globalThis`.

**4. `registrationCode` is server-generated and immutable**
`src/utils/registrationCode.ts` generates `BIB-<base36>-<hex>`. `createBookSchema` intentionally
omits this field so client-submitted values are stripped by the `validate` middleware.

**5. Zod 4 API change**
Zod v4 renamed `ZodError.errors` → `ZodError.issues`. All error mappings use `.issues`.

**6. Vitest `fileParallelism: false` for SQLite**
SQLite allows one writer at a time. Running test files in parallel causes "write readonly database"
errors. `fileParallelism: false` in `vitest.config.ts` serialises test file execution.

**7. Login identifier auto-detection**
`authService.login` detects email vs. CPF by checking for `@` — no separate endpoint per role.

**8. OpenAPI spec as a typed TypeScript module**
`src/docs/openapi.ts` exports the full `OpenAPIV3.Document` spec as a typed object. Served by
`swagger-ui-express` at `/api-docs`.

### Frontend

**9. Angular Signals for state — no NgRx**
All component state uses `signal()`, `computed()`, and `effect()`. No external state library needed
given the scope.

**10. Functional `inject()` instead of constructor injection**
All services are injected via `inject(Service)` in the class body, eliminating `constructor(private ...)`.

**11. JWT decoded client-side via `atob` — no library**
`AuthService.decode()` base64-decodes the JWT payload using native `atob`. The `isLoggedIn` computed
signal verifies expiry (`exp`) without an additional dependency.

**12. Role-based lazy loading**
The `admin` and `usuario` routes are protected by `[authGuard, roleGuard('MANAGER|USER')]` and
load their shell components lazily. Each shell renders a `<router-outlet>` for its child feature
routes.

**13. Auth state persisted in `localStorage`**
`AuthService` stores token under key `biblioflow.token` and user object under `biblioflow.user`.
Signals are initialised from `localStorage` at service creation, so state survives page refresh.

**14. Pure CSS design system — 10 partials**
No CSS framework. All visual tokens (colors, spacing, typography, shadows, radii) are CSS custom
properties in `styles/_variables.css`. Ten partials cover layout, forms, buttons, tables, cards,
badges, modal, toast, utilities, and reset.

**15. Nginx SPA routing**
`frontend/nginx.conf` uses `try_files $uri $uri/ /index.html` so that Angular's client-side router
handles deep links without 404s from the server.

---

## Features

### Backend API

Base URL: `/api/v1`. Routes marked 🔒 require JWT; 👤 require `MANAGER` role.

#### Authentication — `src/routes/auth.ts`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Register MANAGER (email) or USER (CPF) |
| POST | `/auth/login` | public | Authenticate, receive JWT |

`MANAGER` requires `email`; `USER` requires `cpf`. Enforced via `z.superRefine`. Passwords hashed
with bcrypt (10 rounds). JWT payload: `{ sub, role }`.

#### Books — `src/routes/books.ts`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/books` | 🔒 any | Paginated list (10/page) |
| GET | `/books/search` | 🔒 any | Search by `title`, `author`, or `registrationCode` |
| GET | `/books/:id` | 🔒 any | Get single book |
| POST | `/books` | 👤 MANAGER | Create book (auto-generates `registrationCode`) |
| PUT | `/books/:id` | 👤 MANAGER | Update book fields |
| DELETE | `/books/:id` | 👤 MANAGER | Delete book (blocked if active rentals exist → 409) |

#### Rentals — `src/routes/rentals.ts`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/rentals` | 👤 MANAGER | Create rental |
| GET | `/rentals` | 👤 MANAGER | List rentals (filter by `status`) |
| GET | `/rentals/pending` | 👤 MANAGER | List overdue active rentals |
| GET | `/rentals/:id` | 👤 MANAGER | Get rental detail with book and user |
| PATCH | `/rentals/:id/finalize` | 👤 MANAGER | Finalize (return) a rental |

Business rules: valid periods `[15, 30, 45]` days; stock check; per-user limit (`MAX_RENTALS_PER_USER`);
`dueDate = startDate + periodDays`; `late = returnDate > dueDate`; double-finalize guard (→ 409).

#### Donations — `src/routes/donations.ts`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/donations` | 🔒 any | Register a book donation |

`bookId` is optional — the donated book may not yet be in the catalogue.

#### API Documentation

Interactive Swagger UI at **`/api-docs`** (no auth required). Covers all 13 endpoints with request
schemas, query parameters, response schemas, and JWT Bearer security.

---

### Frontend SPA

#### Auth flows (`features/auth/`)

- **Login** (`/login`) — single `identifier + password` form; backend detects email vs. CPF.
  On success, `AuthService.redirectByRole()` routes to `/admin` (MANAGER) or `/usuario` (USER).
- **Register MANAGER** (`/registrar/gestor`) — `fullName`, `phone`, `email`, `password`.
- **Register USER** (`/registrar/usuario`) — `fullName`, `phone`, `cpf`, `password`.
- All forms use Angular Reactive Forms with client-side validation.

#### Admin shell (`features/admin/`)

Protected by `authGuard + roleGuard('MANAGER')`.

- **AdminShellComponent** — CSS Grid layout: sidebar (220 px) + header (56 px) + main area.
  Sidebar links: Dashboard, Exemplares, Locações, Pendentes, Perfil, Sair.
- **DashboardComponent** — summary cards using parallel HTTP calls to `bookService.list()`,
  `rentalService.list('ACTIVE')`, and `rentalService.getPending()`.
- **ExemplaresListComponent** — paginated book table with search (title/author/code),
  uses `PaginationComponent`.
- **ExemplarFormComponent** — shared create/edit form; on create, displays the server-generated
  `registrationCode` in a monospace badge after success.
- **ExemplarDetailComponent** — full book data with Edit and Delete actions; delete triggers
  the reusable `ModalComponent` for confirmation.
- **LocacoesListComponent** — rental table with `ACTIVE | FINALIZED | all` status filter.
  Late rentals highlighted with a danger badge.
- **LocacoesPendentesComponent** — list of overdue active rentals, ordered by `dueDate ASC`.
- **LocacaoFormComponent** — new rental form; `<select>` fixed to options `15 / 30 / 45` days;
  previews calculated `dueDate` before submission.
- **LocacaoDetailComponent** — full rental detail including embedded book and user data.
  "Finalizar Devolução" button visible only when `status === 'ACTIVE'`.
- **PerfilComponent** — manager profile derived from JWT payload and stored user object.

#### User shell (`features/usuario/`)

Protected by `authGuard + roleGuard('USER')`.

- **UsuarioShellComponent** — simplified navigation bar.
- **CatalogoComponent** — book grid with search and pagination.
- **LivroDetalheComponent** — book details and availability.
- **DoacoesComponent** — donation form (title, author, optional book search).

#### Shared components (`shared/components/`)

| Component | Purpose |
|---|---|
| `ToastComponent` | Success/error notification overlay |
| `ModalComponent` | Reusable confirmation dialog (delete confirmation) |
| `PaginationComponent` | Consumes `{ page, pages }` from paginated API responses |
| `SpinnerComponent` | Loading indicator |
| `EmptyStateComponent` | "No results found" placeholder |

#### Core services (`core/services/`)

| Service | Key methods |
|---|---|
| `AuthService` | `login`, `register`, `logout`, `redirectByRole`; signals: `token`, `user`, `role`, `isLoggedIn` |
| `BookService` | `list(page)`, `search(params)`, `getById`, `create`, `update`, `delete` |
| `RentalService` | `list(status?)`, `getPending`, `getById`, `create`, `finalize` |
| `DonationService` | `create(data)` |
| `ToastService` | `success(message)`, `error(message)` |

---

## Data Model

Defined in `prisma/schema.prisma`. All tables use UUID primary keys.

```
User         — id, role (MANAGER|USER), fullName, phone, cpf?, email?,
               passwordHash, createdAt
Book         — id, registrationCode (unique), title, description, author,
               quantity, createdAt
Rental       — id, bookId→Book, userId→User, periodDays, startDate, dueDate,
               returnDate?, status (ACTIVE|FINALIZED), late, createdAt
Donation     — id, bookId?→Book, userId→User, title, author, createdAt
```

---

## Test Suite

**22 tests — 3 files — all passing.** (Backend only; frontend uses Karma/Jasmine scaffolding.)

| File | Coverage |
|---|---|
| `tests/auth.test.ts` | Register (MANAGER/USER), validation rejection, duplicate detection, login, wrong password |
| `tests/books.test.ts` | CRUD, pagination, search, role guard, 401 without token, safe delete |
| `tests/rentals.test.ts` | Create valid/invalid period, stock exhaustion, user limit, finalize, double-finalize, pending list |

Test infrastructure (`tests/setup.ts`): sets `DATABASE_URL=file:./data/test.db` before any module
import, runs `prisma migrate deploy` in `beforeAll`, deletes test DB in `afterAll`.

`tests/helpers.ts` provides `createManagerAndLogin()`, `createUserAndLogin()`, and `seedBook()`.

---

## Infrastructure

### Docker

**Backend `Dockerfile`** — two-stage build:
1. **builder** — installs all deps, compiles TypeScript to `dist/`.
2. **runner** — installs prod deps only, copies `dist/` and `prisma/`.

Container startup runs `prisma migrate deploy` before `node dist/server.js`.

**Frontend `frontend/Dockerfile`** — two-stage build:
1. **builder** — `npm ci`, `npm run build` (Angular output to `dist/frontend/browser`).
2. **server** — Nginx Alpine; copies built assets; `nginx.conf` handles SPA routing.

**`docker-compose.yml`** — two services:
- `api` — backend on port `3000`; named volume `db-data:/app/data` for SQLite persistence.
- `frontend` — Angular SPA served by Nginx on port `4200`; depends on `api`.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port (backend) |
| `NODE_ENV` | `development` | Execution environment |
| `DATABASE_URL` | `file:./data/biblioflow.db` | SQLite file path |
| `JWT_SECRET` | *(must be set)* | Token signing secret |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `MAX_RENTALS_PER_USER` | `3` | Simultaneous rental limit per user |

Frontend environments are compiled into the bundle via `src/environments/environment.ts`
(`apiUrl: 'http://localhost:3000/api/v1'`) and `environment.prod.ts` for Docker networking.

---

## Known Limitations / Backend Gaps

These frontend features require backend endpoints that do not yet exist:

| Feature | Missing endpoint |
|---|---|
| Change manager password / profile data | `PATCH /auth/me` |
| Search users when creating a rental | `GET /users/search?q=` |
| USER views their own rentals | `GET /rentals/minhas` |

The profile security section shows an "in development" banner. The rental creation form accepts a
raw user ID as a text input as a functional fallback.

---

## Commit History

### 2026-06-01 — frontend — feat: implements full Angular 20 SPA frontend

*(Untracked files — not yet committed to the `prod` branch.)*

- Scaffolded Angular 20 standalone project in `frontend/` with TypeScript 5.9, RxJS 7.8,
  Reactive Forms, and HttpClient with functional interceptors.
- Implemented full auth flow: `AuthService` with Angular Signals, JWT decode via `atob`,
  `localStorage` persistence, role-based redirect; `AuthInterceptor` injects Bearer token
  and intercepts 401 → auto-logout.
- Built all MANAGER screens: Dashboard, Exemplares (list/create/edit/detail/delete),
  Locações (list/filter/pending/detail/create/finalize), Perfil.
- Built all USER screens: Catálogo (grid + search + pagination), Livro Detalhe, Doações.
- Added shared components: `ToastComponent`, `ModalComponent`, `PaginationComponent`,
  `SpinnerComponent`, `EmptyStateComponent`.
- Implemented pure CSS design system across 10 partials with CSS custom properties
  (no external CSS framework).
- Added `frontend/Dockerfile` (Angular build → Nginx Alpine) and `frontend/nginx.conf`
  with `try_files` for SPA routing.
- Updated `docker-compose.yml` to add `frontend` service on port `4200`.

---

### 2026-05-19 — cf5e874 — fix(controllers): adapt to Zod v4 and Express 5 type changes

- `ZodError.errors` renamed to `.issues` in Zod v4 — fixed in `book.controller.ts` and
  `rental.controller.ts`.
- Express 5 resolves `req.params` values as `string | string[]`; added explicit `String()`
  coercion where a plain `string` is required.

### 2026-05-19 — c44e8fa — fix(docker): fix native module build and eliminate runner npm ci

- Fixed native module compilation (`better-sqlite3`) inside the Docker builder stage.
- Removed redundant `npm ci` from the runner stage — prod deps already present in builder output.

### 2026-05-19 — 8e16c68 — docs(changelog): atualiza changelog com todos os commits da sessão

- Wrote first `changelog/CHANGELOG.md` covering the full backend session (architecture,
  features, technical notes, commit history).

### 2026-05-19 — 4d4d511 — docs(readme): adiciona tutorial de início rápido no topo do README

- Added "Início rápido" section to `README.md`: steps to run with Docker or locally,
  open Swagger UI, authenticate via seed or manual registration, run tests.

### 2026-05-19 — 63efc8b — feat(docs): adiciona documentação interativa Swagger UI em /api-docs

- Installed `swagger-ui-express` and `openapi-types`.
- Created `src/docs/openapi.ts`: typed `OpenAPIV3.Document` spec for all 13 endpoints,
  4 reusable component schemas, JWT Bearer security scheme, `paginated()` helper.
- Mounted Swagger UI in `src/app.ts` at `/api-docs`.

### 2026-05-19 — b65f0bc — docs: adiciona HANDOFF.md e changelog do projeto

- Created `HANDOFF.md` documenting session state, non-obvious technical decisions, and
  prioritised next steps.
- First version of `changelog/CHANGELOG.md`.

### 2026-05-19 — dcab36e — chore(docker): adiciona Dockerfile multistágio e docker-compose

- Two-stage backend `Dockerfile`: builder compiles TypeScript; runner copies `dist/`.
- `docker-compose.yml` with named volume `db-data:/app/data` for SQLite persistence.
- `.dockerignore` and `.env.example` with all required env vars documented.

### 2026-05-19 — 0760288 — test: adiciona suíte de 22 testes de integração com Vitest e Supertest

- `tests/setup.ts`: isolated test DB, `prisma migrate deploy` in `beforeAll`, cleanup in `afterAll`.
- `tests/helpers.ts`: `createManagerAndLogin`, `createUserAndLogin`, `seedBook` shared helpers.
- 22 tests across `auth.test.ts` (7), `books.test.ts` (8), `rentals.test.ts` (7).
- `vitest.config.ts`: `fileParallelism: false` to prevent concurrent SQLite write errors.

### 2026-05-19 — da5ac51 — feat(doacoes): implementa registro de doações de livros

- Full donation stack: `src/schemas/donation.ts`, repository, service, controller, route.
- `POST /api/v1/donations` — any authenticated user; `bookId` is optional.

### 2026-05-19 — 16f3d38 — feat(locacoes): implementa controle de locações e devoluções

- Full rental stack: schema, repository, service, controller, route.
- Business rules: period `[15, 30, 45]`, stock check, per-user limit, `dueDate` calculation,
  late detection on finalize, double-finalize guard.
- `GET /rentals/pending`: active rentals past their `dueDate`, ordered by `dueDate ASC`.

### 2026-05-19 — 0d1bec3 — feat(livros): implementa CRUD de livros com paginação, busca e código de registro

- Full book stack: schema, repository, service, controller, route.
- `registrationCode` generated server-side; absent from `createBookSchema`.
- `DELETE` blocked when active rentals exist → 409.
- List returns `{ items, total, page, pages }` with 10 items per page.

### 2026-05-19 — 6358e5b — feat(auth): implementa registro e login com JWT e bcrypt

- `registerSchema` uses `z.superRefine` to enforce MANAGER→email and USER→cpf.
- Passwords hashed with bcrypt (10 rounds); duplicates → 409.
- Login auto-detects identifier type via `@` presence.
- JWT signed with `{ sub, role }` payload.

### 2026-05-19 — 18c94a2 — feat(middlewares): implementa autenticação JWT, validação Zod e handler de erros

- `authenticate` middleware: JWT verify + decode onto `req.user`.
- `requireRole(role)` factory: returns 403 on mismatch.
- `validate` middleware: Zod `safeParse`, strips unknown fields, uses `.issues`.
- `errorHandler`: catches `AppError` and `ZodError`; serialises to `{ erro, detalhes }`.

### 2026-05-19 — 01ccda3 — feat(core): adiciona bootstrap do servidor Express e utilitários base

- `src/server.ts`: HTTP listener.
- `src/app.ts`: JSON middleware, four routers, global error handler.
- `src/config/env.ts`: typed env object; fails at import if `JWT_SECRET` missing.
- `src/config/database.ts`: Prisma singleton with `PrismaBetterSqlite3` adapter + `globalThis` cache.
- `src/utils/errors.ts`: `AppError` with `statusCode` and optional `details`.
- `src/utils/registrationCode.ts`: generates `BIB-<base36>-<hex>` codes.

### 2026-05-19 — eedd457 — chore(prisma): define schema de dados, migrações e seed

- Four models: `User`, `Book`, `Rental` (ACTIVE|FINALIZED), `Donation`. All PKs are UUIDs.
- Migration `20260519215725_init` creates all tables.
- `prisma/seed.ts`: one MANAGER, one USER, one sample book.

### 2026-05-19 — b529ea6 — chore: configura projeto Node.js com TypeScript e ferramentas de qualidade

- `package.json` with Express 5, Prisma 7, Zod 4, jsonwebtoken, bcrypt, Vitest, ESLint 10, Prettier.
- `tsconfig.json`: target ES2022, strict mode, `outDir: dist/`.
- `CLAUDE.md`: architecture, conventions, and commands for AI agents.

### 2026-05-19 — 73bd0ad — Update README.md

- Replaced placeholder with full project README in Portuguese covering domain spec, entities,
  business rules, endpoint table, architecture diagram, and implementation roadmap.

### 2026-02-17 — cd9c2d8 — Initial commit

- Repository created with MIT licence, standard Node `.gitignore`, and placeholder README.
