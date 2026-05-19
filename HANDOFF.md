# Handoff — BiblioFlow — 2026-05-19

## Project
Community library REST API (Node.js 24 / Express 5 / TypeScript / SQLite / Prisma 7);
run locally with `npm install && cp .env.example .env && npm run db:migrate && npm run dev`.

## Done this session
- Full project scaffold: `package.json`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`
- Prisma 7 schema (`User`, `Book`, `Rental`, `Donation`), migration, client generated to `src/generated/prisma/`
- `src/config/database.ts` — Prisma singleton via `PrismaBetterSqlite3` adapter
- All four feature layers (schemas → repositories → services → controllers → routes): auth, books, rentals, donations
- 3 middleware files: `authenticate`, `requireRole`, `validate`, `errorHandler`
- 22 integration tests across `tests/auth.test.ts`, `books.test.ts`, `rentals.test.ts` — all passing
- `Dockerfile` (two-stage), `docker-compose.yml` (named volume for SQLite), `.env.example`
- `CLAUDE.md`, `changelog/CHANGELOG.md`, `HANDOFF.md` (this file)
- `~/.claude/statusline.sh` fixed (replaced `jq` with `python3`; `jq` not installed)
- `~/.claude/skills/changelog/SKILL.md` and `~/.claude/skills/handoff/SKILL.md` created

## Current state
- Tests: **22/22 passing** (`npm test`)
- Build: not verified (`npm run build` not run yet)
- Lint: **BROKEN** — ESLint 10 requires flat config (`eslint.config.js`), project has `.eslintrc.json`
  ```
  ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
  ```
- Uncommitted changes: **everything** — only `.gitignore` (modified) and `README.md` are tracked;
  all `src/`, `prisma/`, `tests/`, config files are untracked

## Non-obvious facts
- **Prisma 7 runtime adapter**: `PrismaClient` must receive `new PrismaBetterSqlite3({ url })` as
  `adapter` option — it no longer reads `DATABASE_URL` automatically at runtime. `prisma.config.ts`
  is CLI-only. See `src/config/database.ts`.
- **Prisma 7 no index.ts**: generated client has no `index.ts`; import from
  `../generated/prisma/client` explicitly everywhere.
- **Zod v4 uses `.issues`**: `ZodError.errors` was renamed to `.issues`. Both `validate.ts:10`
  and `errorHandler.ts:12` use `.issues`.
- **Vitest `fileParallelism: false`**: SQLite allows one writer; parallel test files cause
  `"attempt to write a readonly database"`. Set in `vitest.config.ts`.
- **Login identifier auto-detect**: `authService.login` routes to `findByEmail` or `findByCpf`
  based on presence of `@` — no separate endpoint per role.
- **ESLint 10 flat config required**: installed version is 10.4.0; `.eslintrc.json` is the legacy
  format. Must migrate before `npm run lint` works.

## Next steps
1. **Fix ESLint config**: replace `.eslintrc.json` with `eslint.config.js` (flat config format).
   Install `@eslint/js` if needed. Equivalent rules: `@typescript-eslint/recommended` +
   `prettier`. Run `npm run lint` to confirm zero warnings.
2. **Verify TypeScript build**: run `npm run build` and fix any type errors in `dist/`.
3. **Commit all work**: stage and commit everything except `data/`, `.env`, `src/generated/`.
   Suggested message: `feat: implement full BiblioFlow REST API`.
4. **Seed the dev database**: run `npm run db:seed` and smoke-test with `npm run dev` +
   a manual `POST /api/v1/auth/login` using the seeded manager credentials
   (`manager@biblioflow.com` / `secret123`).
