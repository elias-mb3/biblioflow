# Diagrama Entidade-Relacionamento

Modelo de dados do BiblioFlow derivado de `prisma/schema.prisma`.

```mermaid
erDiagram
    USER {
        string id PK "UUID"
        string role "MANAGER ou USER"
        string fullName
        string phone
        string cpf "único; obrigatório para USER"
        string email "único; obrigatório para MANAGER"
        string passwordHash
        datetime createdAt
    }
    BOOK {
        string id PK "UUID"
        string registrationCode UK "BIB-base36-hex"
        string title
        string description
        string author
        int quantity "número de exemplares"
        datetime createdAt
    }
    RENTAL {
        string id PK "UUID"
        string bookId FK
        string userId FK
        int periodDays "15, 30 ou 45"
        datetime startDate
        datetime dueDate "startDate + periodDays"
        datetime returnDate "nulo enquanto ACTIVE"
        string status "ACTIVE ou FINALIZED"
        boolean late "returnDate maior que dueDate"
        datetime createdAt
    }
    DONATION {
        string id PK "UUID"
        string bookId FK "opcional"
        string userId FK
        string title
        string author
        datetime createdAt
    }

    USER ||--o{ RENTAL : "realiza"
    BOOK ||--o{ RENTAL : "é locado em"
    USER ||--o{ DONATION : "registra"
    BOOK |o--o{ DONATION : "pode referenciar"
```

---

## Cardinalidades

| Relação | Cardinalidade | Regra de negócio |
|---|---|---|
| `User → Rental` | 1 para N | Um usuário pode ter várias locações ao longo do tempo; máximo de `MAX_RENTALS_PER_USER` ativas simultaneamente (padrão: 3) |
| `Book → Rental` | 1 para N | Um livro pode ser locado múltiplas vezes (sequencialmente); locações ativas simultâneas limitadas a `Book.quantity` |
| `User → Donation` | 1 para N | Um usuário pode registrar várias doações |
| `Book → Donation` | 0..1 para N | Uma doação pode ou não referenciar um livro já existente no catálogo |

---

## Restrições de integridade

- `registrationCode` é imutável após criação e nunca aceito como input do cliente — gerado pelo servidor no formato `BIB-<base36>-<hex>`.
- `cpf` e `email` são mutuamente exclusivos por perfil: `USER` usa CPF, `MANAGER` usa e-mail.
- `periodDays` aceita somente `15`, `30` ou `45` — validado por Zod antes de atingir o banco.
- Locações `ACTIVE` para um livro não podem exceder `Book.quantity`.
- Um usuário não pode ter mais de `MAX_RENTALS_PER_USER` locações `ACTIVE` simultâneas.
- Um livro não pode ser excluído enquanto possuir locações `ACTIVE`.
