# BiblioFlow

> Sistema completo de gestão de biblioteca comunitária — interface web Angular + API REST para digitalização e organização do acervo literário da Igreja Presbiteriana do Brasil (IPB).

Projeto de extensão universitária **BiblioFlow: Transformação Comunitária**,
vinculado ao projeto institucional InovaTec do curso de Análise e
Desenvolvimento de Sistemas (UNASP). O objetivo é democratizar o acesso à
leitura na comunidade local por meio de uma solução de software livre,
hospedada em modelo *self-hosted*. O sistema é composto por uma **API REST** (Node.js + Express) e uma **interface web** (Angular 20), ambos containerizados com Docker.

---

## Início rápido

> Siga os passos abaixo para rodar a API e testar todos os endpoints em
> menos de dois minutos.

### 1. Pré-requisitos

| Opção | Requisito |
|-------|-----------|
| Docker (recomendado) | Docker Engine + Docker Compose |
| Local | Node.js 20 LTS |

### 2. Subir a API

**Com Docker:**

```bash
cp .env.example .env
docker compose up --build
```

**Localmente:**

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

A API sobe em **http://localhost:3000**.

O frontend sobe em **http://localhost:4200**.

### 3. Documentação interativa (Swagger UI)

Abra **http://localhost:3000/api-docs** no navegador.

Todos os endpoints estão documentados com exemplos de corpo de requisição,
parâmetros e respostas possíveis.

### 4. Autenticar e testar

**Opção A — seed automático** (mais rápido):

```bash
npm run db:seed
```

Isso cria um gestor e um usuário de exemplo. Use as credenciais abaixo
diretamente no Swagger UI:

| Perfil | Identificador | Senha |
|--------|--------------|-------|
| MANAGER | `manager@biblioflow.com` | `secret123` |
| USER | CPF `12345678901` | `secret123` |

**Opção B — cadastro manual no Swagger UI:**

1. Expanda `POST /auth/register` → clique em **Try it out**.
2. Envie o corpo abaixo para criar um MANAGER:
   ```json
   {
     "role": "MANAGER",
     "fullName": "Gestor Teste",
     "phone": "11999999999",
     "email": "gestor@teste.com",
     "password": "secret123"
   }
   ```
3. Expanda `POST /auth/login` e faça login com o e-mail e senha acima.
4. Copie o `token` da resposta.

### 5. Usar o token no Swagger UI

1. Clique em **Authorize** (ícone 🔒 no topo da página).
2. Cole o token no campo **Value** (sem `Bearer `, apenas o token).
3. Clique em **Authorize** → **Close**.

A partir daqui todos os endpoints protegidos ficam liberados. Teste a
sequência sugerida:

```
POST /books          → cadastrar um livro
GET  /books          → listar o acervo
POST /auth/register  → cadastrar um USER (com CPF)
POST /rentals        → criar uma locação
PATCH /rentals/{id}/finalize → devolver o livro
GET  /rentals/pending        → ver devoluções em atraso
POST /donations      → registrar uma doação
```

### 6. Rodar os testes automatizados

```bash
npm test
# 22 testes de integração — deve finalizar com 22 passed
```

---

## Sumário

- [Início rápido](#início-rápido)
- [Visão geral](#visão-geral)
- [Stack técnica](#stack-técnica)
- [Domínio e regras de negócio](#domínio-e-regras-de-negócio)
  - [Perfis de usuário](#perfis-de-usuário)
  - [Entidades](#entidades)
  - [Regras de negócio](#regras-de-negócio)
  - [Fluxo operacional de locação](#fluxo-operacional-de-locação)
- [Endpoints da API](#endpoints-da-api)
- [Arquitetura do projeto](#arquitetura-do-projeto)
- [Documentação técnica](#documentação-técnica)
- [Como executar](#como-executar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Testes](#testes)
- [Convenções de código](#convenções-de-código)
- [Roadmap de implementação](#roadmap-de-implementação)
- [Licença](#licença)

---

## Visão geral

O BiblioFlow permite que uma instituição cadastre seu acervo, controle
locações (empréstimos) e devoluções, e disponibilize a consulta de livros para
a comunidade. O repositório contém a **API REST** (backend) e a **interface web Angular** (frontend).

Necessidades atendidas, por perfil:

- **Instituição** — disponibilizar o acervo online para membros e visitantes;
  cadastrar o acervo no sistema; saber quantos livros possui, quem está com
  cada exemplar e por quanto tempo.
- **Gestor** — disponibilizar livros para locação; saber quem está com cada
  livro, quando será devolvido e quem está com devolução pendente.
- **Cliente** — visualizar livros disponíveis; realizar uma locação; doar
  livros para o acervo comunitário.

---

## Stack técnica

**Backend:**

| Camada          | Tecnologia                                          |
|-----------------|-----------------------------------------------------|
| Linguagem       | TypeScript (strict mode)                            |
| Runtime         | Node.js 20 LTS                                      |
| Framework HTTP  | Express 5                                           |
| Banco de dados  | SQLite (arquivo único, persistido em volume Docker) |
| ORM             | Prisma 7 + `@prisma/adapter-better-sqlite3`         |
| Validação       | Zod 4                                               |
| Autenticação    | JWT (`jsonwebtoken`) + `bcrypt` (10 rounds)         |
| Testes          | Vitest 4 + Supertest                                |
| Qualidade       | ESLint 10 + Prettier                                |
| API Docs        | Swagger UI + OpenAPI 3.0 (`/api-docs`)              |

**Frontend:**

| Camada          | Tecnologia                                          |
|-----------------|-----------------------------------------------------|
| Framework       | Angular 20 (componentes standalone)                 |
| Linguagem       | TypeScript 5.9                                      |
| Estado          | Angular Signals                                     |
| Formulários     | Reactive Forms + HttpClient                         |
| Estilização     | CSS puro — custom properties, sem framework CSS     |
| Servidor web    | Nginx Alpine (Docker)                               |

**Infraestrutura:**

| Camada          | Tecnologia                                               |
|-----------------|----------------------------------------------------------|
| Containerização | Docker + Docker Compose (serviços `api` e `frontend`)    |

> **Observação sobre o banco:** SQLite é um banco em arquivo, não um servidor.
> Não há container separado. O arquivo `.db` é persistido em um volume Docker
> para sobreviver a recriações do container da API.

---

## Domínio e regras de negócio

Esta seção é a **fonte da verdade** do comportamento do sistema. Toda
implementação deve respeitá-la.

### Perfis de usuário

Há dois perfis autenticáveis no sistema:

| Perfil   | Descrição                                    | Dados de cadastro             |
|----------|----------------------------------------------|-------------------------------|
| `GESTOR` | Administra o acervo e as locações            | Nome, Telefone, E-mail        |
| `USUARIO`| Cliente que realiza locações e doações       | Nome completo, Telefone, CPF  |

**Permissões do Gestor:**

- *Acervo:* dar entrada de novos exemplares, remover exemplares, editar
  exemplares e buscar exemplares.
- *Locação:* gerar uma ordem de locação (para usuário existente ou novo
  cadastro), consultar uma locação (tempo, status e usuário) e finalizar uma
  locação quando o usuário devolve o livro.

### Entidades

**Livro**

| Campo                | Tipo      | Observação                                       |
|----------------------|-----------|--------------------------------------------------|
| `id`                 | string    | Identificador interno (UUID)                     |
| `codigoRegistro`     | string    | Gerado automaticamente no cadastro; único        |
| `nome`               | string    | Título da obra                                   |
| `descricao`          | string    | Sinopse ou descrição                             |
| `autor`              | string    | Autor da obra                                    |
| `quantidade`         | int       | Número de exemplares no acervo                   |
| `criadoEm`           | datetime  | Data de cadastro                                 |

**Usuario**

| Campo            | Tipo    | Observação                                |
|------------------|---------|-------------------------------------------|
| `id`             | string  | Identificador interno (UUID)              |
| `perfil`         | enum    | `GESTOR` ou `USUARIO`                     |
| `nomeCompleto`   | string  | Nome do usuário                           |
| `telefone`       | string  | Telefone de contato                       |
| `cpf`            | string  | Obrigatório para perfil `USUARIO`; único  |
| `email`          | string  | Obrigatório para perfil `GESTOR`; único   |
| `senhaHash`      | string  | Hash da senha (bcrypt)                    |

**Locacao**

| Campo            | Tipo      | Observação                                          |
|------------------|-----------|-----------------------------------------------------|
| `id`             | string    | Identificador interno (UUID)                        |
| `livroId`        | string    | Referência ao livro locado                          |
| `usuarioId`      | string    | Referência ao usuário que locou                     |
| `periodoDias`    | int       | Período da locação: `15`, `30` ou `45`              |
| `dataInicio`     | datetime  | Data de início da locação                           |
| `dataPrevista`   | datetime  | `dataInicio` + `periodoDias`                        |
| `dataDevolucao`  | datetime? | Preenchida na finalização da locação                |
| `status`         | enum      | `ATIVA` ou `FINALIZADA`                             |
| `atraso`         | boolean   | `true` se a devolução ocorreu após `dataPrevista`   |

### Regras de negócio

1. **Um livro pode estar locado para um usuário por vez.** Cada exemplar tem
   um estado de locação; o número de locações `ATIVA` de um livro não pode
   ultrapassar a `quantidade` de exemplares disponíveis.
2. **Um usuário pode ter N livros locados simultaneamente**, desde que dentro
   do limite de locação definido pela configuração (`LIMITE_LOCACAO_USUARIO`).
3. **Atraso na devolução.** Quando a finalização da locação ocorre após a
   `dataPrevista`, o campo `atraso` é marcado como `true`.
4. **Períodos de locação válidos:** apenas `15`, `30` ou `45` dias. Qualquer
   outro valor deve ser rejeitado na validação.
5. **Código de registro.** É gerado automaticamente no cadastro do livro e é
   imutável. Não pode ser informado pelo cliente da API.
6. **Listagem de livros é paginada**, com 10 itens por página por padrão.
7. **Busca de livros** aceita filtro por nome, autor ou código de registro.

### Fluxo operacional de locação

1. O gestor cadastra os livros; o cadastro gera o `codigoRegistro`.
2. O gestor consulta a listagem paginada ou busca um livro por nome, autor ou
   código.
3. Ao iniciar uma locação, verifica-se se o usuário já possui cadastro:
   - **Possui cadastro:** a locação prossegue.
   - **Não possui:** realiza-se o cadastro do usuário e a locação continua.
4. Define-se o período de locação (`15`, `30` ou `45` dias).
5. Na devolução, o gestor finaliza a locação. Se o prazo houver sido
   ultrapassado, a locação é marcada com `atraso = true`.

---

## Endpoints da API

Prefixo base: `/api/v1`. Rotas marcadas com 🔒 exigem autenticação;
rotas marcadas com 👤 exigem perfil `GESTOR`.

### Autenticação

| Método | Rota               | Descrição                          |
|--------|--------------------|------------------------------------|
| POST   | `/auth/registrar`  | Cadastra um usuário (gestor/cliente)|
| POST   | `/auth/login`      | Autentica e retorna um token JWT   |

### Livros

| Método | Rota                  | Acesso | Descrição                                |
|--------|-----------------------|--------|------------------------------------------|
| GET    | `/livros`             | 🔒     | Lista livros (paginado, 10 por página)   |
| GET    | `/livros/busca`       | 🔒     | Busca por `nome`, `autor` ou `codigo`    |
| GET    | `/livros/:id`         | 🔒     | Detalha um livro                         |
| POST   | `/livros`             | 👤     | Cadastra um livro (gera `codigoRegistro`)|
| PUT    | `/livros/:id`         | 👤     | Edita um livro                           |
| DELETE | `/livros/:id`         | 👤     | Remove um livro                          |

### Locações

| Método | Rota                          | Acesso | Descrição                          |
|--------|-------------------------------|--------|------------------------------------|
| POST   | `/locacoes`                   | 👤     | Gera uma ordem de locação          |
| GET    | `/locacoes`                   | 👤     | Lista locações (filtro por status) |
| GET    | `/locacoes/:id`               | 👤     | Consulta tempo, status e usuário   |
| PATCH  | `/locacoes/:id/finalizar`     | 👤     | Finaliza a locação (devolução)     |
| GET    | `/locacoes/pendentes`         | 👤     | Lista devoluções pendentes         |

### Doações

| Método | Rota          | Acesso | Descrição                                  |
|--------|---------------|--------|--------------------------------------------|
| POST   | `/doacoes`    | 🔒     | Registra uma doação de livro ao acervo     |

> Padrão de resposta: JSON. Erros retornam
> `{ "erro": "mensagem legível", "detalhes": [...] }` com o status HTTP
> apropriado (400 validação, 401 não autenticado, 403 sem permissão,
> 404 não encontrado, 409 conflito de regra de negócio).

---

## Arquitetura do projeto

Organização em camadas, separando rota, regra de negócio e acesso a dados.

```
biblioflow/
├── src/                           # Backend — API REST
│   ├── server.ts                  # Bootstrap do Express
│   ├── app.ts                     # Middlewares e registro de rotas
│   ├── config/                    # Env, constantes, conexão com o banco
│   ├── routes/                    # Definição das rotas por recurso
│   ├── controllers/               # Recebem a requisição, chamam os services
│   ├── services/                  # Regras de negócio (camada principal)
│   ├── repositories/              # Acesso ao banco de dados (Prisma)
│   ├── middlewares/               # Autenticação JWT, validação, erro global
│   ├── schemas/                   # Schemas Zod por recurso
│   ├── docs/                      # Spec OpenAPI 3.0 (Swagger UI)
│   ├── types/                     # Interfaces compartilhadas
│   └── utils/                     # AppError, gerador de codigoRegistro
├── frontend/                      # Frontend — Angular SPA
│   ├── src/app/
│   │   ├── core/                  # Guards, interceptors, models, services
│   │   ├── shared/                # Toast, Modal, Pagination, Spinner…
│   │   └── features/              # Auth, Admin (exemplares, locações), Usuário
│   ├── src/styles/                # Design system — 10 partials CSS
│   ├── Dockerfile                 # Build Angular → Nginx Alpine
│   └── nginx.conf                 # SPA routing (try_files)
├── docs/                          # Documentação técnica
│   ├── diagrama-er.md             # Diagrama Entidade-Relacionamento
│   ├── diagrama-entidades.md      # Diagrama de Entidades (classes)
│   └── diagrama-sequencia.md      # Diagramas de Sequência
├── prisma/                        # Schema e migrações
├── tests/                         # 22 testes de integração (Vitest + Supertest)
├── data/                          # Arquivo SQLite (montado como volume Docker)
├── .env.example
├── Dockerfile                     # Backend — build multistágio
├── docker-compose.yml             # Orquestra os serviços api + frontend
├── package.json
└── README.md
```

Princípios:

- **Controllers não contêm regra de negócio** — apenas orquestram.
- **Services concentram as regras** descritas na seção de domínio.
- **Repositories isolam o acesso ao banco** — nenhuma query SQL fora deles.
- **Validação na borda** — todo corpo de requisição passa por um schema Zod
  antes de chegar ao controller.

---

## Documentação técnica

Os diagramas técnicos do projeto estão em [`docs/`](./docs/):

| Documento | Descrição |
|---|---|
| [`docs/guia-usuario.md`](./docs/guia-usuario.md) | Guia prático — como ligar o sistema e usar todas as funcionalidades (não-técnico) |
| [`docs/diagrama-er.md`](./docs/diagrama-er.md) | Diagrama Entidade-Relacionamento — tabelas, campos, cardinalidades e restrições |
| [`docs/diagrama-entidades.md`](./docs/diagrama-entidades.md) | Diagrama de Entidades — atributos detalhados de cada modelo com tipos e validações |
| [`docs/diagrama-sequencia.md`](./docs/diagrama-sequencia.md) | Diagramas de Sequência — 10 fluxos completos (registro, login, CRUD, locação, frontend) |

Os diagramas usam sintaxe **Mermaid**, renderizada nativamente pelo GitHub.

---

## Como executar

### Com Docker (recomendado)

```bash
# 1. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 2. Suba a aplicação
docker compose up --build

# A API ficará disponível em http://localhost:3000
```

### Localmente (sem Docker)

```bash
# Requer Node.js 20 LTS
npm install
cp .env.example .env
npm run db:migrate     # Aplica as migrações no SQLite
npm run dev            # Inicia em modo desenvolvimento
```

### Scripts disponíveis

| Script              | Descrição                                  |
|---------------------|--------------------------------------------|
| `npm run dev`       | Inicia a API em modo desenvolvimento       |
| `npm run build`     | Compila o TypeScript para `dist/`          |
| `npm start`         | Executa a versão compilada                 |
| `npm test`          | Executa a suíte de testes                  |
| `npm run lint`      | Verifica o código com ESLint               |
| `npm run db:migrate`| Aplica as migrações do banco               |
| `npm run db:seed`   | Popula o banco com dados de exemplo        |

---

## Variáveis de ambiente

Descritas em `.env.example`. Nenhum valor sensível deve ser commitado.

| Variável                  | Descrição                              | Exemplo                  |
|----------------------------|----------------------------------------|--------------------------|
| `PORT`                     | Porta da API                           | `3000`                   |
| `NODE_ENV`                 | Ambiente de execução                   | `development`            |
| `DATABASE_URL`             | Caminho do arquivo SQLite              | `file:./data/biblioflow.db` |
| `JWT_SECRET`               | Segredo para assinar os tokens JWT     | *(gerar valor aleatório)*|
| `JWT_EXPIRES_IN`           | Validade do token                      | `1d`                     |
| `LIMITE_LOCACAO_USUARIO`   | Máximo de livros locados por usuário   | `3`                      |

---

## Banco de dados

- SGBD: **SQLite**, arquivo único.
- O arquivo fica em `./data/biblioflow.db` e é persistido em um volume Docker,
  de modo que os dados sobrevivam à recriação do container.
- Migrações versionadas controlam a evolução do schema; não editar o banco
  manualmente.
- Há um script de *seed* para popular dados de exemplo em desenvolvimento.

---

## Testes

- Framework: **Vitest** para testes unitários e **Supertest** para testes de
  integração das rotas HTTP.
- Cobertura mínima esperada: as regras de negócio da seção de domínio
  (limites de locação, períodos válidos, marcação de atraso, geração de
  código de registro).
- Os testes usam um banco SQLite separado e descartável.

---

## Convenções de código

- Idioma do código (variáveis, funções): português, alinhado ao domínio.
- Idioma de mensagens de commit: português.
- Formatação automática com Prettier; lint com ESLint — sem warnings.
- Sem segredos no repositório: usar `.env` (já no `.gitignore`).
- Commits pequenos e descritivos (padrão sugerido: Conventional Commits).

---

## Roadmap de implementação

Sequência sugerida para a construção da API:

1. **Setup** — inicializar projeto, TypeScript, ESLint/Prettier, estrutura de
   pastas, Docker e Docker Compose.
2. **Banco** — modelar as entidades, configurar migrações e o seed.
3. **Autenticação** — cadastro, login, hash de senha, middleware JWT e de
   verificação de perfil.
4. **Livros** — CRUD completo, geração de código de registro, paginação e
   busca.
5. **Locações** — criação com as regras de negócio, consulta, finalização
   com marcação de atraso, listagem de pendências.
6. **Doações** — registro de doação ao acervo.
7. **Testes** — cobertura das regras de negócio e das rotas.
8. **Documentação** — finalizar este README e o manual de operação.

---

## Licença

Projeto acadêmico de extensão universitária. Software livre, destinado ao uso
da entidade parceira e da comunidade. Defina aqui a licença escolhida
(ex.: MIT).
