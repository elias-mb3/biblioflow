# BiblioFlow API

> Sistema de gestão de biblioteca comunitária — API REST para digitalização e
> organização do acervo literário da Igreja Presbiteriana do Brasil (IPB).

Projeto de extensão universitária **BiblioFlow: Transformação Comunitária**,
vinculado ao projeto institucional InovaTec do curso de Análise e
Desenvolvimento de Sistemas (UNASP). O objetivo é democratizar o acesso à
leitura na comunidade local por meio de uma solução de software livre,
hospedada em modelo *self-hosted*.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack técnica](#stack-técnica)
- [Domínio e regras de negócio](#domínio-e-regras-de-negócio)
  - [Perfis de usuário](#perfis-de-usuário)
  - [Entidades](#entidades)
  - [Regras de negócio](#regras-de-negócio)
  - [Fluxo operacional de locação](#fluxo-operacional-de-locação)
- [Endpoints da API](#endpoints-da-api)
- [Arquitetura do projeto](#arquitetura-do-projeto)
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
a comunidade. O escopo deste repositório é a **API REST de backend**.

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

| Camada            | Tecnologia                                          |
|-------------------|-----------------------------------------------------|
| Linguagem         | TypeScript                                          |
| Runtime           | Node.js 20 LTS                                      |
| Framework HTTP    | Express                                             |
| Banco de dados    | SQLite (arquivo único, persistido em volume Docker) |
| Acesso a dados    | Prisma ORM (ou `better-sqlite3` — ver observação)   |
| Validação         | Zod                                                 |
| Autenticação      | JWT (`jsonwebtoken`) + `bcrypt` para hash de senha  |
| Testes            | Vitest + Supertest                                  |
| Qualidade         | ESLint + Prettier                                   |
| Containerização   | Docker + Docker Compose                             |

> **Observação sobre o banco:** SQLite é um banco em arquivo, não um servidor.
> Não há container separado de banco. O arquivo `.db` é persistido em um
> volume Docker para sobreviver a recriações do container da API. O Docker
> Compose deve subir apenas o serviço da API.

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
biblioflow-api/
├── src/
│   ├── server.ts              # Bootstrap do Express
│   ├── app.ts                 # Configuração de middlewares e rotas
│   ├── config/                # Env, constantes, conexão com o banco
│   ├── routes/                # Definição das rotas por recurso
│   ├── controllers/           # Recebem a requisição, chamam os services
│   ├── services/              # Regras de negócio (camada principal)
│   ├── repositories/          # Acesso ao banco de dados
│   ├── middlewares/           # Autenticação, tratamento de erros
│   ├── schemas/               # Schemas de validação (Zod)
│   ├── types/                 # Tipos e interfaces compartilhados
│   └── utils/                 # Funções auxiliares (ex: gerar código)
├── prisma/                    # Schema e migrações (se usar Prisma)
├── tests/                     # Testes de integração e unitários
├── data/                      # Arquivo SQLite (montado como volume)
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── tsconfig.json
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
