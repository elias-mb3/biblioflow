# 0001 — Open Library é o provedor primário de metadados por ISBN, com Google Books como fallback opcional

- **Status:** Aceito
- **Complementado por:** [0005](0005-brasilapi-cbl-para-catalogo-brasileiro.md) — a limitação de
  cobertura registrada abaixo se mostrou alta demais na prática e a BrasilAPI (CBL) foi acrescentada
  à cadeia. A Open Library segue como provedor primário.
- **Data:** 2026-08-05
- **Contexto da feature:** [`docs/plans/cadastro-livros-por-isbn.md`](../plans/cadastro-livros-por-isbn.md)
- **Frentes afetadas:** BACKEND

## Contexto

O cadastro de exemplares por ISBN depende de uma base externa de metadados bibliográficos. O
BiblioFlow é um projeto de extensão universitária, self-hosted em Docker por uma igreja, sem
orçamento para APIs pagas e sem infraestrutura para gerenciar segredos de terceiros. Qualquer
provedor que exija cadastro, cartão de crédito ou chave obrigatória adiciona um passo de
configuração que trava o `docker compose up --build` documentado no README.

## Decisão

Usamos a **Open Library** como provedor primário, via
`GET https://openlibrary.org/api/books?bibkeys=ISBN:<isbn13>&format=json&jscmd=data`.

Implicações práticas:

- Nenhuma chave de API é necessária — a feature funciona out-of-the-box.
- O cliente envia `User-Agent: BiblioFlow/1.0 (+github.com/elias-mb3/biblioflow)`, conforme a
  política de uso da Open Library, que bloqueia requisições com User-Agent genérico ou ausente.
- Respostas (inclusive "não encontrado") são cacheadas em memória com TTL, e as rotas de lookup
  ficam atrás de um rate limiter, atendendo ao pedido de uso moderado da Open Library.
- O **Google Books** fica como fallback, acionado apenas quando a Open Library não encontra o ISBN
  **e** a variável `GOOGLE_BOOKS_API_KEY` está preenchida. Sem a chave, o provedor retorna `null`
  imediatamente, sem gastar uma requisição.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Google Books como primário | Verificado em 2026-08-05: chamada anônima a `https://www.googleapis.com/books/v1/volumes?q=isbn:...` retorna **HTTP 429** com `quota_limit_value: "0"`. A doc oficial confirma que requisições sem OAuth precisam de API key. Tornaria a feature inutilizável sem configuração prévia. |
| ISBNdb / provedores comerciais | Pagos por volume. Incompatível com um projeto de extensão sem orçamento. |
| Base local de ISBNs (dump da Open Library) | O dump completo tem dezenas de GB. Desproporcional para um acervo comunitário de centenas de títulos rodando em SQLite. |
| Nenhum provedor (só cadastro manual) | É exatamente o problema que a feature resolve. |

## Consequências

**Positivas**
- Zero configuração obrigatória: nenhuma variável de ambiente nova é necessária para a feature
  funcionar.
- Sem dependência de conta, faturamento ou rotação de chave em produção.
- Cobertura razoável de títulos brasileiros — verificado com `9788535902778` ("A ditadura
  envergonhada", Companhia das Letras), que retorna título, autor, editora, ano, páginas e capa.

**Negativas / custo aceito**
- A Open Library não publica SLA nem rate limit formal. Se ficar fora do ar, o lookup responde 503
  e o gestor precisa cadastrar manualmente — por isso o cadastro manual **nunca** é removido.
- A cobertura de catálogo é menor que a do Google Books, especialmente para edições nacionais
  recentes. O fallback opcional existe para mitigar isso em instalações que queiram configurar a
  chave.
- A resposta de `jscmd=data` não traz descrição, o que força uma segunda chamada — ver ADR 0004.

**Como reverter**
Barato. Os provedores implementam a mesma assinatura `fetchByIsbn(isbn13): Promise<BookMetadata | null>`
e são orquestrados por `src/services/isbnLookup.service.ts`. Trocar a ordem de prioridade ou
adicionar um terceiro provedor é uma mudança localizada nesse arquivo, sem tocar controller, rota
ou frontend.

## Referências

- [Google Books API — Using the API](https://developers.google.com/books/docs/v1/using)
- [Open Library API — política de uso (FreeAPIHub)](https://freeapihub.com/apis/open-library)
- Verificação empírica dos dois endpoints, registrada no discovery da feature.
