# Plano de Melhorias — BiblioFlow

> **Status:** Fase 0 (planejamento) — aguardando aprovação antes de qualquer implementação.
> Documento vivo; cada fase só inicia após a anterior estar verde (`npm test` + `npm run lint`).

## Convenções confirmadas no código (importante)

Apesar do CLAUDE.md mencionar "código em português", o código atual segue, de fato:

- **Identificadores em inglês**: `books`, `rentals`, `users`, `MANAGER`/`USER`, `fullName`, `registrationCode`, `quantity`, `periodDays`, etc.
- **Mensagens de erro, UI e commits em português**: `'CPF já cadastrado'`, labels, Conventional Commits em PT.
- **Pastas de feature no frontend em português**: `exemplares`, `locacoes`, `usuario`.

➡️ Vou **seguir o código existente** (inglês nos identificadores, PT nas mensagens/UI/commits), o que coincide com a especificação dos endpoints `/users` que você passou. Os modelos de resposta seguem o shape de erro `{ erro, detalhes }` e o de paginação `{ items, total, page, pages }`.

### Padrões reutilizados (referências de implementação)

| Padrão | Arquivo de referência |
|---|---|
| Paginação backend (10/página) | `src/repositories/book.repository.ts` (`list`, `search`) |
| Camadas route→controller→service→repo | qualquer recurso, ex. `books` |
| Validação Zod + shape de erro | `src/middlewares/validate.ts`, `src/schemas/book.ts` |
| Auth + role guard | `src/middlewares/auth.ts` (`authenticate`, `requireRole('MANAGER')`) |
| Doc OpenAPI | `src/docs/openapi.ts` (schemas reutilizáveis + `paths`) |
| Teste de integração (banco real) | `tests/books.test.ts`, `tests/helpers.ts` |
| Service Angular | `frontend/src/app/core/services/book.service.ts` |
| Lista paginada + busca (front) | `frontend/.../admin/exemplares/exemplares-list.ts` |
| Autocomplete de busca (front) | `frontend/.../admin/locacoes/locacao-form/locacao-form.ts` (bloco "1. Livro") |

---

## Fase 1 — Gestão de usuários + corrigir fluxo de empréstimo `[BLOQUEADOR DA DEMO]`

**Objetivo:** o gestor cadastra/lista usuários pelo painel, e a tela "Nova locação" passa a selecionar o usuário por autocomplete (nome/CPF), eliminando o campo de UUID colado à mão.

### Backend

| Tarefa | Arquivo |
|---|---|
| Adicionar `findMany({ q?, page })` com busca opcional por `fullName`/`cpf` (filtro `role: 'USER'`) e paginação 10/página, espelhando `book.repository.search` | `src/repositories/user.repository.ts` (editar) |
| `userSearchSchema` (`q?`, `page` coerce default 1) e `createUserSchema` (USER: `fullName`, `phone`, `cpf` obrigatório, `password` min 6) reaproveitando regras do `registerSchema` | `src/schemas/user.ts` (novo) |
| Service: `list`, `getById` (404 se não achar), `create` — reusa hash do `auth.service` (extrair helper `hashPassword` em `auth.service` e chamá-lo, sem duplicar bcrypt); **nunca** retorna `passwordHash` nem token | `src/services/user.service.ts` (novo); `src/services/auth.service.ts` (editar: expor `hashPassword`) |
| Controller `list`/`getById`/`create` no padrão dos demais controllers | `src/controllers/user.controller.ts` (novo) |
| Router com `authenticate` + `requireRole('MANAGER')` no topo; `GET /`, `GET /:id`, `POST /` (`validate(createUserSchema)`) | `src/routes/users.ts` (novo) |
| Registrar `app.use('/api/v1/users', usersRouter)` | `src/app.ts` (editar) |
| Doc OpenAPI: tag `Usuários`, paths `/users` (GET lista+busca, POST) e `/users/{id}` (GET); resposta sem `passwordHash` | `src/docs/openapi.ts` (editar) |

**Decisões de desenho (confirmadas com o cliente):**
- ✅ **Convenção:** identificadores em inglês (segue o código atual), mensagens/UI/commits em PT.
- ✅ `POST /users` cria **somente perfil USER** nesta fase. O CPF é a chave; e-mail não se aplica. Reaproveita a checagem de CPF duplicado já existente. (Criar MANAGER autenticado fica para a Fase 2.)
- ✅ `GET /users` filtra **`role: 'USER'`** (gestor gerencia leitores). Busca por `OR: [{ fullName contains q }, { cpf contains q }]`.
- Resposta de usuário (helper de serialização) omite `passwordHash` explicitamente.
- Validação de **formato** de CPF fica fora de escopo (código atual só checa duplicidade/comprimento); eventual validação real entra na Fase 5.

### Frontend

| Tarefa | Arquivo |
|---|---|
| `UserService` espelhando `BookService`: `list(page)`, `search(q, page)`, `getById(id)`, `create(data)` apontando para `/users` | `frontend/src/app/core/services/user.service.ts` (novo) |
| Tipos `PaginatedUsers = Paginated<User>` e `CreateUserRequest` | `frontend/src/app/core/models/user.model.ts` (editar) |
| Feature lista paginada + busca (espelha `exemplares-list`) | `frontend/src/app/features/admin/usuarios/usuarios-list.{ts,html,css}` (novo) |
| Feature formulário de novo usuário (espelha `exemplar-form`) | `frontend/src/app/features/admin/usuarios/usuario-form/usuario-form.{ts,html,css}` (novo) |
| Rotas `admin/usuarios` e `admin/usuarios/novo` | `frontend/src/app/app.routes.ts` (editar) |
| Item "Usuários" no menu lateral, grupo novo (ex.: "Comunidade") | `admin-shell.html` (editar) |
| **Substituir** campo UUID por autocomplete nome/CPF no bloco "2. Usuário", espelhando exatamente o bloco "1. Livro" (signals `userResults`, `selectedUser`, `searching`; `userId` vem da seleção). Remover `Validators.minLength(8)` de `userId` e o `<small>` que diz que a busca não existe | `locacao-form.{ts,html}` (editar) |

### Testes
`tests/users.test.ts` (banco real, padrão `tests/helpers.ts`):
- 201 ao criar USER como MANAGER; resposta **sem** `passwordHash`.
- 409 ao criar com CPF duplicado.
- `GET /users` lista paginada (estrutura `{ items, total, page, pages }`).
- `GET /users?q=` busca por nome e por CPF.
- `GET /users/:id` → 200 existente / 404 inexistente.
- Proteção: 401 sem token; 403 com token de USER em todas as rotas.

### Critérios de aceite (Fase 1)
- ✅ `npm test` e `npm run lint` verdes (testes novos inclusos).
- ✅ OpenAPI mostra `/users` e `/users/{id}` no Swagger.
- ✅ Na demo: gestor abre "Usuários", cadastra um leitor, ele aparece na lista; em "Nova locação" busca o usuário por nome/CPF e cria o empréstimo **sem digitar UUID**.

---

## Fase 2 — Segurança

| Tarefa | Arquivo |
|---|---|
| Gate de registro de MANAGER: registro público de gestor só quando **não existe nenhum MANAGER** (bootstrap do 1º admin). Depois, novo MANAGER só via gestor autenticado. `auth.service.register` checa `userRepository.countManagers()` e lança 403 se já houver. Configurável via env `ALLOW_PUBLIC_MANAGER_BOOTSTRAP` (default `true`) | `src/services/auth.service.ts`, `src/repositories/user.repository.ts` (add `countByRole`), `src/config/env.ts` |
| `env.ts`: remover fallback hardcoded de `JWT_SECRET`; falhar no boot se `NODE_ENV=production` e secret ausente ou == valor de exemplo (`dev-secret-change-in-production`) | `src/config/env.ts` |
| `helmet` + CORS com origem explícita via env (`CORS_ORIGIN`) + rate limit em `/auth` (`express-rate-limit`) | `src/app.ts`, `package.json` (add `helmet`, `cors`, `express-rate-limit` + `@types/cors`) |
| `.env.example` documenta `CORS_ORIGIN`, `ALLOW_PUBLIC_MANAGER_BOOTSTRAP`; README nota sobre `JWT_SECRET` obrigatório em produção | `.env.example`, `README.md` |
| Doc OpenAPI: 403 no `POST /auth/register` quando bootstrap já consumido | `src/docs/openapi.ts` |

### Testes
`tests/auth.test.ts` (ampliar) ou `tests/auth-security.test.ts`:
- 1º MANAGER público → 201; 2º MANAGER público → 403.
- MANAGER autenticado consegue criar outro MANAGER (via `/users` ou rota dedicada — **decidir na implementação**, ver ambiguidade abaixo).
- Rate limit retorna 429 após N tentativas em `/auth/login` (teste tolerante a flakiness).

> ⚠️ **Ambiguidade a confirmar antes da Fase 2:** o enunciado da Fase 1 diz que `POST /users` cria USER. Para "novos MANAGER só por gestor autenticado", preciso de um caminho para criar MANAGER autenticado. Proposta: aceitar `role` opcional em `POST /users` (default USER; só MANAGER pode criar MANAGER). Confirmo o desenho ao chegar nesta fase.

### Critérios de aceite (Fase 2)
- ✅ Boot falha em produção sem `JWT_SECRET` válido; testes do gate verdes; headers `helmet` presentes; CORS restrito; `npm test`/`lint` verdes.

---

## Fase 3 — Operação e self-hosting

| Tarefa | Arquivo |
|---|---|
| `GET /api/v1/health` verificando o banco (`SELECT 1` via `prisma.$queryRaw`) → `{ status: 'ok', db: 'up' }` / 503 se falhar | `src/routes/health.ts` (novo), `src/controllers/health.controller.ts` (novo), `src/app.ts` |
| `healthcheck` no serviço `api` do compose apontando para `/api/v1/health` | `docker-compose.yml` |
| Doc OpenAPI do `/health` (tag `Operação`) | `src/docs/openapi.ts` |
| README: seção backup/restore do volume `db-data` + exemplo Caddy (reverse proxy TLS automático) na frente de `api`/`frontend` | `README.md`, `Caddyfile.example` (novo) |
| CI: `npm ci`, `npm run lint`, `npm test` em PR/push | `.github/workflows/ci.yml` (novo) |

### Critérios de aceite (Fase 3)
- ✅ `curl /api/v1/health` responde 200; `docker compose` reporta o serviço healthy; CI verde no push; README com backup/restore e Caddy.

---

## Fase 4 — Doações com ciclo de vida

| Tarefa | Arquivo |
|---|---|
| Enum `DonationStatus` (`PENDING`/`ACCEPTED`/`REJECTED`/`CATALOGED`) + campo `status` default `PENDING` em `Donation`; migração Prisma (`npm run db:migrate`) | `prisma/schema.prisma`, nova migração |
| Repo: `findMany({ status?, page })`, `updateStatus` | `src/repositories/donation.repository.ts` |
| Service/Controller/Rotas MANAGER: `GET /donations` (lista paginada, filtro status), `PATCH /donations/:id/review` (aceitar/recusar/catalogar). Ao ACEITAR/CATALOGAR: opcionalmente criar `Book` novo ou `quantity++` de existente (`bookId` no corpo) | `donation.service.ts`, `donation.controller.ts`, `routes/donations.ts`, `schemas/donation.ts` |
| Tela do gestor para revisar doações pendentes | `frontend/.../admin/doacoes/*` (novo), service + menu + rotas |
| Doc OpenAPI das novas rotas; `status` no schema de doação | `src/docs/openapi.ts` |

### Testes
`tests/donations.test.ts`: criação fica `PENDING`; listagem por status; aceitar cria/incrementa Book e marca `CATALOGED`/`ACCEPTED`; recusar marca `REJECTED`; proteção de rota.

### Critérios de aceite (Fase 4)
- ✅ Fluxo completo de revisão funcional na UI e via API; `npm test`/`lint` verdes.

---

## Fase 5 — Melhorias de produto (opcional, só se houver tempo)

- Histórico de empréstimos por usuário / ficha do leitor (reaproveita `GET /users/:id` + locações do usuário).
- Catálogo: `isbn`, `category`/tags, `coverUrl` (migração + UI + busca).
- Comunidade OSS: `CONTRIBUTING.md`, templates de issue/PR, screenshots no README.

---

## Regras transversais (todas as fases)
- 1 branch por fase; commits atômicos em Conventional Commits (PT).
- Toda rota/regra nova tem teste de integração (sem mock de banco) + doc OpenAPI atualizada.
- Não quebrar testes existentes; `npm run lint` com zero warnings.
- Não tocar em `src/generated/prisma`.
- Parar e reportar ao fim de cada fase; só seguir para a próxima após verde + sua aprovação.
</content>
</invoke>
