# Registros de Decisão de Arquitetura (ADR)

Decisões técnicas do BiblioFlow, em ordem cronológica. Formato: [MADR](https://adr.github.io/madr/)
enxuto.

Um ADR aceito **não é editado nem apagado** — ele é registro histórico. Mudança de rumo entra como
um ADR novo, e o antigo passa a `Substituído por NNNN`.

| # | Decisão | Status | Data |
|---|---|---|---|
| [0001](0001-open-library-como-provedor-primario-de-metadados.md) | Open Library é o provedor primário de metadados por ISBN, com Google Books como fallback opcional | Aceito | 2026-08-05 |
| [0002](0002-isbn13-normalizado-como-chave-natural.md) | O ISBN é persistido como ISBN-13 normalizado, em coluna opcional e única | Aceito | 2026-08-05 |
| [0003](0003-isbn-duplicado-incrementa-estoque.md) | Cadastrar por ISBN um livro já existente incrementa o estoque em vez de falhar | Aceito | 2026-08-05 |
| [0004](0004-descricao-obtida-do-work-com-fallback-sintetizado.md) | A descrição vem de uma segunda chamada ao Work da Open Library, com fallback sintetizado | Aceito | 2026-08-05 |
| [0005](0005-brasilapi-cbl-para-catalogo-brasileiro.md) | A BrasilAPI (CBL) entra na cadeia como provedor do catálogo brasileiro | Aceito | 2026-08-05 |
