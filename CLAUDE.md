# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BiblioFlow is a community library management REST API for Igreja Presbiteriana do Brasil (IPB), built as a university extension project (UNASP). Stack: Node.js 20 LTS, TypeScript, Express, SQLite, Prisma ORM, Zod, JWT + bcrypt, Vitest + Supertest.

## Commands

```bash
npm run dev          # Dev server with hot reload
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled output
npm test             # Run full test suite (Vitest + Supertest)
npm run lint         # ESLint check (must pass with zero warnings)
npm run db:migrate   # Apply Prisma migrations to SQLite
npm run db:seed      # Seed development data
```

Run a single test file: `npx vitest run tests/path/to/file.test.ts`

Docker (recommended):
```bash
cp .env.example .env
docker compose up --build   # API available at http://localhost:3000
```

## Architecture

Layered architecture: `routes → controllers → services → repositories`

```
src/
├── server.ts          # Express bootstrap
├── app.ts             # Middleware and route registration
├── config/            # Env vars, constants, DB connection
├── routes/            # Route definitions per resource
├── controllers/       # Parse request, call service, return response
├── services/          # All business rules live here
├── repositories/      # All DB queries live here (no queries elsewhere)
├── middlewares/       # JWT auth, role guard, error handler
├── schemas/           # Zod validation schemas
├── types/             # Shared TypeScript types and interfaces
└── utils/             # Pure helpers (e.g., codigoRegistro generator)
```

- Controllers contain **no business logic** — they orchestrate only.
- Services are the source of truth for domain rules.
- Repositories are the only layer that touches the database.
- Every request body is validated by a Zod schema before reaching a controller.

## Domain rules (source of truth)

**User profiles:** `GESTOR` (manages collection and rentals) and `USUARIO` (rents and donates books). Gestors authenticate with email; Usuarios with CPF.

**Locacao (rental) rules:**
- A book's active rentals cannot exceed its `quantidade` (stock count).
- A user cannot exceed `LIMITE_LOCACAO_USUARIO` simultaneous active rentals.
- Valid `periodoDias` values: `15`, `30`, `45` only — reject any other value.
- `dataPrevista` = `dataInicio` + `periodoDias`.
- On finalization: if `dataDevolucao > dataPrevista`, set `atraso = true`.

**Livro rules:**
- `codigoRegistro` is auto-generated on creation and immutable — never accept it from the client.
- Listing is paginated at 10 items per page.
- Search accepts `nome`, `autor`, or `codigoRegistro` filters.

## API

Base prefix: `/api/v1`. Routes marked 🔒 require JWT auth; 👤 require `GESTOR` role.

- `POST /auth/registrar`, `POST /auth/login`
- `GET /livros` 🔒, `GET /livros/busca` 🔒, `GET /livros/:id` 🔒
- `POST /livros` 👤, `PUT /livros/:id` 👤, `DELETE /livros/:id` 👤
- `POST /locacoes` 👤, `GET /locacoes` 👤, `GET /locacoes/:id` 👤
- `PATCH /locacoes/:id/finalizar` 👤, `GET /locacoes/pendentes` 👤
- `POST /doacoes` 🔒

Error response shape: `{ "erro": "mensagem legível", "detalhes": [...] }` with appropriate HTTP status (400/401/403/404/409).

## Conventions

- **Code language:** Portuguese (variable names, function names, messages) — aligned to the domain.
- **Commit language:** Portuguese, Conventional Commits style.
- **Formatting:** Prettier auto-formats; ESLint must pass with zero warnings.
- **Database:** SQLite file at `./data/biblioflow.db`, persisted in a Docker volume. Schema changes go through Prisma migrations only — never edit the DB manually.
- **Tests:** use a separate, disposable SQLite database. Business rules and HTTP routes both need coverage.

## Environment variables

See `.env.example`. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path, e.g. `file:./data/biblioflow.db` |
| `JWT_SECRET` | Random secret for signing tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1d` |
| `LIMITE_LOCACAO_USUARIO` | Max simultaneous rentals per user |
