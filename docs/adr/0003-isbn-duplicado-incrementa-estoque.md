# 0003 — Cadastrar por ISBN um livro já existente incrementa o estoque em vez de falhar

- **Status:** Aceito
- **Data:** 2026-08-05
- **Contexto da feature:** [`docs/plans/cadastro-livros-por-isbn.md`](../plans/cadastro-livros-por-isbn.md)
- **Frentes afetadas:** BACKEND · FRONTEND

## Contexto

Numa biblioteca comunitária, receber mais de um exemplar do mesmo título é rotina — doações
repetidas, compras em lote. O modelo de dados já reflete isso: `Book.quantity` conta exemplares
físicos de um mesmo registro, e as regras de locação comparam locações ativas contra `quantity`.

Com o ISBN virando chave única (ADR 0002), o `POST /books/isbn` de um título já cadastrado tem duas
saídas possíveis: falhar com 409, ou somar ao estoque. A escolha amarra o contrato do cliente e o
fluxo de tela do gestor, então precisa ser explícita.

## Decisão

`POST /api/v1/books/isbn` é **idempotente por ISBN quanto à criação de registro**, não quanto ao
estoque:

- ISBN ainda não cadastrado → cria o `Book`, responde **201** com `"incremented": false`.
- ISBN já cadastrado → soma `quantity` ao registro existente, responde **200** com
  `"incremented": true`, devolvendo o livro atualizado.

O caminho **manual** mantém o comportamento oposto: `POST /api/v1/books` com um `isbn` que já
existe responde **409** `'Já existe um livro cadastrado com este ISBN'`.

A diferença é intencional. `POST /books/isbn` é o fluxo de "chegou exemplar na mesa, registra" — o
gestor não está tentando criar uma obra nova, está dando entrada em estoque. `POST /books` é
cadastro de catálogo, onde um ISBN repetido indica erro de digitação e merece ser barrado.

Para tornar isso previsível na UI, `GET /books/isbn/:isbn` devolve `alreadyRegistered` e
`existingBookId`, permitindo ao formulário avisar **antes** de submeter.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| 409 também no `POST /books/isbn` | Obriga o gestor a sair do fluxo, buscar o livro, abrir a edição e somar `quantity` à mão — três telas para a operação mais comum do dia a dia. |
| Criar um segundo `Book` com o mesmo ISBN | Viola o `@unique` do ADR 0002 e quebra a contagem de disponibilidade das locações, que assume um registro por título. |
| Endpoint separado `PATCH /books/:id/quantity` | Resolve o incremento, mas não elimina o passo de descobrir o `id` a partir do ISBN. O `POST /books/isbn` já tem o ISBN em mãos. |
| Sempre incrementar, inclusive no `POST /books` manual | Mascara erro de digitação de ISBN no cadastro de catálogo, inflando silenciosamente o estoque do livro errado. |

## Consequências

**Positivas**
- Uma única ação de tela cobre o caso mais frequente do acervo comunitário.
- Casa com o leitor de código de barras previsto para uma iteração futura: bipar o mesmo ISBN duas
  vezes registra dois exemplares, que é o comportamento esperado.
- O cliente distingue os dois casos pelo status HTTP **e** pelo campo `incremented`, sem precisar
  comparar estado anterior.

**Negativas / custo aceito**
- Dois status de sucesso (200 e 201) no mesmo endpoint: o frontend precisa tratar ambos, e a
  mensagem de toast muda conforme o caso.
- Um ISBN bipado por engano aumenta o estoque em silêncio. Mitigado pelo aviso de
  `alreadyRegistered` na tela antes do envio e pela possibilidade de corrigir `quantity` na edição.
- O endpoint não é idempotente no sentido estrito de HTTP: repetir a chamada muda o estado. É
  aceitável porque `POST` não promete idempotência.

**Como reverter**
Barato hoje, caro depois. A regra vive em `bookService.createFromIsbn` e trocá-la por 409 é uma
mudança de poucas linhas — mas é **quebra de contrato** para qualquer cliente já integrado, e
exigiria substituir o fluxo de tela do gestor por um caminho de três passos.

## Referências

- Regras de locação em `src/services/rental.service.ts`, que comparam locações ativas com
  `Book.quantity` — a razão de o modelo tratar exemplares como contador, e não como linhas.
- ADR 0002 — o `@unique` que torna a decisão necessária.
