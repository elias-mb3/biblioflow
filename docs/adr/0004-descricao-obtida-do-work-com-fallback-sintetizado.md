# 0004 — A descrição vem de uma segunda chamada ao Work da Open Library, com fallback sintetizado

- **Status:** Aceito
- **Data:** 2026-08-05
- **Contexto da feature:** [`docs/plans/cadastro-livros-por-isbn.md`](../plans/cadastro-livros-por-isbn.md)
- **Frentes afetadas:** BACKEND

## Contexto

`Book.description` é `String` **NOT NULL** no schema desde a migração inicial
(`prisma/migrations/20260519215725_init/migration.sql`), e `createBookSchema` exige
`z.string().min(1)`. Toda tela do sistema exibe a descrição: `exemplar-detail.html` e
`livro-detalhe.html` renderizam `{{ b.description }}` sem tratamento de vazio.

O endpoint escolhido no ADR 0001 (`/api/books?...&jscmd=data`) **não retorna descrição** — retorna
título, autores, editora, data, páginas, assuntos e capa. Verificado empiricamente em 2026-08-05.
Ou seja: o provedor primário não consegue, sozinho, preencher um campo obrigatório do modelo.

## Decisão

A descrição é buscada numa **segunda chamada** ao registro de Work da Open Library
(`GET https://openlibrary.org/works/{workKey}.json`, campo `description`), e quando ela não existe
cai num texto **sintetizado** a partir dos metadados que já temos.

- O campo `description` do Work vem em duas formas — `string` ou `{ type, value }`. Ambas são
  normalizadas para `string`.
- A segunda chamada é **best-effort**: falha, timeout ou Work inexistente **não** invalidam o
  resultado do lookup. O fluxo cai no fallback e segue.
- Fallback: `"<title>, de <author>. Editora <publisher>, <ano>. <n> páginas."`, montado apenas com
  os campos presentes. O resultado **nunca** é string vazia, porque isso reprovaria no
  `z.string().min(1)` do próprio schema do projeto.
- A descrição preenchida é sempre **editável** no formulário antes de salvar — o gestor revisa.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Tornar `Book.description` opcional | Migração que afeta duas telas do frontend, o schema Zod e o contrato de `POST /books` — impacto muito maior que a feature, e degrada o catálogo do leitor. |
| Gravar descrição vazia e deixar o gestor preencher | Reprova no `createBookSchema` (`min(1)`) e produz cards vazios no catálogo do usuário. |
| Usar `jscmd=details` em vez de `jscmd=data` | Devolve a estrutura interna do registro, com formato menos estável e ainda sem garantia de descrição na edição. |
| Usar só o Google Books, que traz `description` na mesma resposta | Exigiria API key obrigatória — contraria o ADR 0001. |
| Usar os `subjects` da resposta como descrição | Produz texto como "History, Human rights, Military government", que não é uma descrição e polui o catálogo. |

## Consequências

**Positivas**
- O campo obrigatório é sempre preenchido com algo legível, sem afrouxar o modelo de dados.
- O caminho feliz entrega a sinopse real da obra, que é o que o leitor vê no catálogo.

**Negativas / custo aceito**
- Até **duas requisições HTTP externas** por lookup de ISBN inédito, aumentando a latência.
  Mitigado pelo cache com TTL: consultas repetidas do mesmo ISBN não saem para a rede.
- O texto sintetizado é claramente automático. É melhor que vazio, e o gestor pode reescrever antes
  de salvar.
- Mais um ponto de falha externo no caminho — por isso é best-effort e nunca derruba o lookup.

**Como reverter**
Barato. A busca da descrição está isolada em `src/services/providers/openLibrary.provider.ts`. Se
um provedor futuro trouxer descrição na resposta principal, basta parar de chamar o Work — nada
fora do provider muda.

## Referências

- `prisma/migrations/20260519215725_init/migration.sql` — `"description" TEXT NOT NULL`.
- `frontend/.../exemplar-detail/exemplar-detail.html` e
  `frontend/.../catalogo/livro-detalhe/livro-detalhe.html` — telas que renderizam a descrição sem
  tratamento de vazio.
- Verificação empírica do `jscmd=data` (sem descrição) e do endpoint de Work (com descrição),
  registrada no discovery da feature.
