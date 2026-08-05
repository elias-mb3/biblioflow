# 0005 — A BrasilAPI (CBL) entra na cadeia como provedor do catálogo brasileiro

- **Status:** Aceito
- **Data:** 2026-08-05
- **Contexto da feature:** [`docs/plans/cadastro-livros-por-isbn.md`](../plans/cadastro-livros-por-isbn.md)
- **Complementa:** [0001](0001-open-library-como-provedor-primario-de-metadados.md)
- **Frentes afetadas:** BACKEND

## Contexto

O ADR 0001 previu, como custo aceito, que "a cobertura de catálogo [da Open Library] é menor (…)
especialmente para edições nacionais recentes". Na primeira validação com um livro real esse custo
se mostrou alto demais: `9788550819853` ("Fundamentals of software architecture", Alta Books, 2022)
está na Agência Brasileira do ISBN, mas a Open Library responde `{}` — não conhece o ISBN.

O BiblioFlow atende uma biblioteca comunitária da IPB, cujo acervo é majoritariamente de **edições
brasileiras**. Um provedor que erra justamente nesse recorte inverte a proposta da feature: o gestor
digita o ISBN, não encontra nada e digita tudo à mão de qualquer jeito.

O fallback do Google Books não resolve, porque exige `GOOGLE_BOOKS_API_KEY` e fica desligado por
padrão (ADR 0001).

## Decisão

A **BrasilAPI** (`https://brasilapi.com.br/api/isbn/v1/{isbn}`) entra como **segundo** provedor da
cadeia, entre a Open Library e o Google Books. Ela expõe os dados da **CBL — Câmara Brasileira do
Livro**, a agência oficial do ISBN no país (o campo `provider` da resposta vem como `"cbl"`), é
gratuita e não exige chave.

Ordem final: **Open Library → BrasilAPI → Google Books**.

A Open Library continua em primeiro porque é a única que traz **capa e sinopse reais**; a BrasilAPI
retorna `synopsis` e `cover_url` nulos na maioria dos registros. Manter a mais rica na frente
preserva a qualidade dos dados para os livros que ela conhece, e a BrasilAPI cobre exatamente o
buraco que sobrava.

Três características da BrasilAPI que a integração precisa absorver:

- **Só cobre ISBNs de prefixo brasileiro** (978-85 / 978-65). Para qualquer outro ela responde
  `400 { "message": "ISBN inválido" }`. Essa mensagem significa "fora do meu escopo", **não**
  dígito verificador incorreto. Por isso o provider converte **qualquer** resposta não-OK em `null`
  e segue a cadeia — propagar aquele 400 quebraria todos os livros internacionais, que hoje
  funcionam.
- **Dados esparsos**: `authors: []`, `year: null`, `page_count: 0` e `publisher: null` aparecem em
  registros antigos. O provider cai em `'Autor não informado'` e na descrição sintetizada do ADR 0004.
- **O campo `isbn` da resposta não é confiável como chave**: a CBL às vezes devolve o ISBN-10 do
  registro, diferente do ISBN-13 consultado. O provider descarta esse valor e mantém o ISBN-13
  normalizado (ADR 0002), que é o que vai para a coluna única.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Tornar o Google Books obrigatório (exigir a chave) | Contraria o ADR 0001: acaba com o "funciona sem configuração", que é o requisito de self-hosting do projeto. |
| Raspar `cblservicos.org.br` diretamente | Sem contrato público, quebra a cada mudança de HTML e é uso abusivo de um site que não oferece API. |
| API do Mercado Editorial | **Verificado em 2026-08-05: descontinuada.** O endpoint responde `410 gone` e redireciona para um serviço novo (`bookinfometadados.com.br`), de contrato não verificado. |
| Colocar a BrasilAPI em primeiro | Perderia capa e sinopse nos livros que a Open Library conhece, degradando o catálogo do leitor — que é onde a capa tem mais valor. |
| Usar a agregação multi-provedor da própria BrasilAPI | Concentraria toda a feature num único serviço mantido pela comunidade. A cadeia própria sobrevive à queda de qualquer elo. |

## Consequências

**Positivas**
- Edições brasileiras passam a ser encontradas — o caso de uso principal do acervo da IPB.
- Continua sem exigir chave, cadastro ou configuração.
- A cadeia virou uma lista (`PROVIDERS`) percorrida em ordem: acrescentar ou reordenar provedores
  é uma linha em `src/services/isbnLookup.service.ts`.

**Negativas / custo aceito**
- Até **três** requisições externas para um ISBN inédito não encontrado. Mitigado pelo cache com
  TTL, que guarda inclusive o "não encontrado".
- Livros vindos da CBL chegam sem capa e com descrição sintetizada — o gestor edita antes de salvar.
- Mais um serviço de terceiro no caminho. A BrasilAPI é mantida pela comunidade e não publica SLA;
  se cair, o provider devolve `null` e a cadeia segue.

**Como reverter**
Trivial: remover o item da lista `PROVIDERS`. Nenhuma outra camada conhece os provedores.

## Referências

- [BrasilAPI — ISBN](https://brasilapi.com.br/docs#tag/ISBN)
- Verificação empírica em 2026-08-05: `9788550819853` ausente na Open Library e presente na
  BrasilAPI com `provider: "cbl"`; `9780140328721` (internacional) recebendo `400 "ISBN inválido"`
  da BrasilAPI e sendo resolvido normalmente pela Open Library.
