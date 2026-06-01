# Diagramas de Sequência

Fluxos principais do BiblioFlow entre as camadas: **Cliente / Frontend Angular → API (Express) → Banco de dados (SQLite via Prisma)**.

---

## 1. Registro — MANAGER

`POST /api/v1/auth/register` com `role: "MANAGER"`.

```mermaid
sequenceDiagram
    actor Cliente
    participant API as Express API
    participant Zod
    participant DB as SQLite (Prisma)
    participant Bcrypt

    Cliente->>API: POST /auth/register {role, fullName, phone, email, password}
    API->>Zod: validate(body)
    alt body inválido
        Zod-->>API: ZodError
        API-->>Cliente: 400 {erro, detalhes}
    else body válido
        Zod-->>API: parsed input
        API->>DB: findByEmail(email)
        alt e-mail já existe
            DB-->>API: User
            API-->>Cliente: 409 {erro: "E-mail já cadastrado"}
        else e-mail disponível
            DB-->>API: null
            API->>Bcrypt: hash(password, 10)
            Bcrypt-->>API: passwordHash
            API->>DB: create(User)
            DB-->>API: User
            API-->>Cliente: 201 {id, role, fullName}
        end
    end
```

---

## 2. Registro — USER

`POST /api/v1/auth/register` com `role: "USER"`. Idêntico ao MANAGER, mas valida CPF em vez de e-mail.

```mermaid
sequenceDiagram
    actor Cliente
    participant API as Express API
    participant Zod
    participant DB as SQLite (Prisma)
    participant Bcrypt

    Cliente->>API: POST /auth/register {role, fullName, phone, cpf, password}
    API->>Zod: validate(body)
    alt body inválido
        Zod-->>API: ZodError
        API-->>Cliente: 400 {erro, detalhes}
    else body válido
        Zod-->>API: parsed input
        API->>DB: findByCpf(cpf)
        alt CPF já existe
            DB-->>API: User
            API-->>Cliente: 409 {erro: "CPF já cadastrado"}
        else CPF disponível
            DB-->>API: null
            API->>Bcrypt: hash(password, 10)
            Bcrypt-->>API: passwordHash
            API->>DB: create(User)
            DB-->>API: User
            API-->>Cliente: 201 {id, role, fullName}
        end
    end
```

---

## 3. Login

`POST /api/v1/auth/login`. O backend detecta automaticamente se o identificador é e-mail (MANAGER) ou CPF (USER) pela presença de `@`.

```mermaid
sequenceDiagram
    actor Cliente
    participant API as Express API
    participant DB as SQLite (Prisma)
    participant Bcrypt
    participant JWT

    Cliente->>API: POST /auth/login {identifier, password}
    API->>API: identifier.includes('@') ?
    alt identificador com @ — MANAGER
        API->>DB: findByEmail(identifier)
    else identificador sem @ — USER
        API->>DB: findByCpf(identifier)
    end
    alt usuário não encontrado
        DB-->>API: null
        API-->>Cliente: 401 {erro: "Credenciais inválidas"}
    else usuário encontrado
        DB-->>API: User
        API->>Bcrypt: compare(password, passwordHash)
        alt senha incorreta
            Bcrypt-->>API: false
            API-->>Cliente: 401 {erro: "Credenciais inválidas"}
        else senha correta
            Bcrypt-->>API: true
            API->>JWT: sign({sub, role}, secret, expiresIn)
            JWT-->>API: token
            API-->>Cliente: 200 {token, user{id, role, fullName}}
        end
    end
```

---

## 4. Criar livro

`POST /api/v1/books` — requer MANAGER.

```mermaid
sequenceDiagram
    actor Gestor
    participant API as Express API
    participant Auth as Middleware Auth
    participant Zod
    participant Utils as registrationCode
    participant DB as SQLite (Prisma)

    Gestor->>API: POST /books {title, author, description, quantity} + Bearer token
    API->>Auth: authenticate(token)
    alt token inválido ou ausente
        Auth-->>API: 401
        API-->>Gestor: 401 {erro: "Token inválido"}
    else token válido
        Auth-->>API: req.user = {sub, role}
        API->>Auth: requireRole('MANAGER')
        alt role != MANAGER
            Auth-->>API: 403
            API-->>Gestor: 403 {erro: "Acesso restrito"}
        else role == MANAGER
            API->>Zod: validate(body)
            Note over Zod: registrationCode ausente do schema —<br/>campo é stripado mesmo se enviado pelo cliente
            Zod-->>API: parsed input
            API->>Utils: generateRegistrationCode()
            Utils-->>API: "BIB-LKZP3A4-C9F2E1"
            API->>DB: create(Book)
            DB-->>API: Book
            API-->>Gestor: 201 Book
        end
    end
```

---

## 5. Excluir livro (com bloqueio por locação ativa)

`DELETE /api/v1/books/:id` — requer MANAGER.

```mermaid
sequenceDiagram
    actor Gestor
    participant API as Express API
    participant Auth as Middleware Auth
    participant DB as SQLite (Prisma)

    Gestor->>API: DELETE /books/:id + Bearer token
    API->>Auth: authenticate + requireRole('MANAGER')
    Auth-->>API: ok
    API->>DB: findBookById(id)
    alt livro não encontrado
        DB-->>API: null
        API-->>Gestor: 404 {erro: "Livro não encontrado"}
    else livro encontrado
        DB-->>API: Book
        API->>DB: countActiveRentals(bookId)
        alt locações ativas > 0
            DB-->>API: count > 0
            API-->>Gestor: 409 {erro: "Livro possui locações ativas"}
        else sem locações ativas
            DB-->>API: 0
            API->>DB: delete(Book)
            DB-->>API: ok
            API-->>Gestor: 204 No Content
        end
    end
```

---

## 6. Criar locação

`POST /api/v1/rentals` — requer MANAGER. Aplica quatro validações de negócio em sequência.

```mermaid
sequenceDiagram
    actor Gestor
    participant API as Express API
    participant Auth as Middleware Auth
    participant Zod
    participant DB as SQLite (Prisma)

    Gestor->>API: POST /rentals {bookId, userId, periodDays} + Bearer token
    API->>Auth: authenticate + requireRole('MANAGER')
    Auth-->>API: ok
    API->>Zod: validate(body)
    alt periodDays fora de [15, 30, 45]
        Zod-->>API: ZodError
        API-->>Gestor: 400 {erro, detalhes}
    else body válido
        Zod-->>API: parsed input
        API->>DB: findBook(bookId)
        alt livro não encontrado
            DB-->>API: null
            API-->>Gestor: 404 {erro: "Livro não encontrado"}
        else livro encontrado
            DB-->>API: Book
            API->>DB: findUser(userId)
            alt usuário não encontrado
                DB-->>API: null
                API-->>Gestor: 404 {erro: "Usuário não encontrado"}
            else usuário encontrado
                DB-->>API: User
                API->>DB: countActiveRentals(bookId)
                alt ativas >= Book.quantity
                    DB-->>API: count >= quantity
                    API-->>Gestor: 409 {erro: "Não há exemplares disponíveis"}
                else exemplares disponíveis
                    API->>DB: countUserActiveRentals(userId)
                    alt ativas >= MAX_RENTALS_PER_USER
                        DB-->>API: count >= limit
                        API-->>Gestor: 409 {erro: "Usuário atingiu o limite de locações"}
                    else dentro do limite
                        DB-->>API: count < limit
                        API->>API: dueDate = startDate + periodDays
                        API->>DB: createRental(data)
                        DB-->>API: Rental
                        API-->>Gestor: 201 Rental
                    end
                end
            end
        end
    end
```

---

## 7. Finalizar locação (devolução)

`PATCH /api/v1/rentals/:id/finalize` — requer MANAGER.

```mermaid
sequenceDiagram
    actor Gestor
    participant API as Express API
    participant Auth as Middleware Auth
    participant DB as SQLite (Prisma)

    Gestor->>API: PATCH /rentals/:id/finalize + Bearer token
    API->>Auth: authenticate + requireRole('MANAGER')
    Auth-->>API: ok
    API->>DB: findRental(id)
    alt locação não encontrada
        DB-->>API: null
        API-->>Gestor: 404 {erro: "Locação não encontrada"}
    else locação encontrada
        DB-->>API: Rental
        alt status == FINALIZED
            API-->>Gestor: 409 {erro: "Locação já foi finalizada"}
        else status == ACTIVE
            API->>API: returnDate = now()
            API->>API: late = returnDate > dueDate
            API->>DB: update(Rental, {returnDate, late, status: FINALIZED})
            DB-->>API: Rental atualizado
            API-->>Gestor: 200 Rental
        end
    end
```

---

## 8. Registrar doação

`POST /api/v1/donations` — qualquer usuário autenticado.

```mermaid
sequenceDiagram
    actor Usuario
    participant API as Express API
    participant Auth as Middleware Auth
    participant Zod
    participant DB as SQLite (Prisma)

    Usuario->>API: POST /donations {title, author, bookId?} + Bearer token
    API->>Auth: authenticate(token)
    alt token inválido
        Auth-->>API: 401
        API-->>Usuario: 401 {erro: "Token inválido"}
    else token válido
        Auth-->>API: req.user = {sub, role}
        API->>Zod: validate(body)
        Zod-->>API: parsed input
        API->>DB: findUser(req.user.sub)
        alt usuário não encontrado
            DB-->>API: null
            API-->>Usuario: 404 {erro: "Usuário não encontrado"}
        else usuário encontrado
            DB-->>API: User
            API->>DB: createDonation({userId, title, author, bookId?})
            DB-->>API: Donation
            API-->>Usuario: 201 Donation
        end
    end
```

---

## 9. Login no frontend Angular

Interação entre o usuário, os componentes Angular e a API.

```mermaid
sequenceDiagram
    actor Usuario as Usuário
    participant Login as LoginComponent
    participant AuthSvc as AuthService
    participant Interceptor as AuthInterceptor
    participant API as Express API
    participant Router as Angular Router

    Usuario->>Login: preenche identifier + password
    Usuario->>Login: submete formulário
    Login->>AuthSvc: login({identifier, password})
    AuthSvc->>API: POST /auth/login (rota pública — sem Authorization)
    API-->>AuthSvc: 200 {token, user}
    AuthSvc->>AuthSvc: persist(token, user)<br/>localStorage + Signals atualizado
    AuthSvc->>Login: Observable completa
    Login->>AuthSvc: redirectByRole()
    alt role == MANAGER
        AuthSvc->>Router: navigate('/admin')
    else role == USER
        AuthSvc->>Router: navigate('/usuario')
    end

    Note over Interceptor: Em todas as requisições subsequentes:
    Login->>Interceptor: HTTP request para rota protegida
    Interceptor->>Interceptor: getToken() do localStorage
    Interceptor->>API: request + Authorization: Bearer token
    alt token expirado ou inválido
        API-->>Interceptor: 401
        Interceptor->>AuthSvc: logout()
        AuthSvc->>Router: navigate('/login')
    else token válido
        API-->>Interceptor: 200 response
        Interceptor-->>Login: response
    end
```

---

## 10. Busca e paginação de livros (frontend)

`GET /api/v1/books?page=N` e `GET /api/v1/books/search?title=X`.

```mermaid
sequenceDiagram
    actor Gestor
    participant Lista as ExemplaresListComponent
    participant BookSvc as BookService
    participant API as Express API

    Gestor->>Lista: acessa /admin/exemplares
    Lista->>BookSvc: list(page=1)
    BookSvc->>API: GET /books?page=1
    API-->>BookSvc: {items[], total, page:1, pages}
    BookSvc-->>Lista: PaginatedBooks
    Lista->>Lista: renderiza tabela + PaginationComponent

    Gestor->>Lista: digita no campo de busca
    Note over Lista: debounce 300ms
    Lista->>BookSvc: search({title: "..."})
    BookSvc->>API: GET /books/search?title=...
    API-->>BookSvc: Book[]
    BookSvc-->>Lista: resultado filtrado

    Gestor->>Lista: clica página 2
    Lista->>BookSvc: list(page=2)
    BookSvc->>API: GET /books?page=2
    API-->>BookSvc: {items[], total, page:2, pages}
    BookSvc-->>Lista: PaginatedBooks atualizado
```
