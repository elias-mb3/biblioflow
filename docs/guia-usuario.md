# Guia Prático — BiblioFlow

Este guia mostra, passo a passo, como ligar o sistema, criar contas e usar todas as funcionalidades do BiblioFlow. Não é necessário nenhum conhecimento técnico.

---

## Sumário

1. [Ligando o sistema](#1-ligando-o-sistema)
2. [Abrindo o BiblioFlow no navegador](#2-abrindo-o-biblioflow-no-navegador)
3. [Criando a conta do Gestor](#3-criando-a-conta-do-gestor)
4. [Painel do Gestor](#4-painel-do-gestor)
   - [Dashboard](#41-dashboard)
   - [Cadastrar um livro](#42-cadastrar-um-livro)
   - [Consultar e editar um livro](#43-consultar-e-editar-um-livro)
   - [Excluir um livro](#44-excluir-um-livro)
   - [Registrar uma locação](#45-registrar-uma-locação)
   - [Devolver um livro](#46-devolver-um-livro-finalizar-locação)
   - [Ver devoluções em atraso](#47-ver-devoluções-em-atraso)
   - [Meu Perfil](#48-meu-perfil)
5. [Cadastrando um Usuário (membro)](#5-cadastrando-um-usuário-membro)
6. [O que o Usuário pode fazer](#6-o-que-o-usuário-pode-fazer)
   - [Catálogo de livros](#61-catálogo-de-livros)
   - [Registrar uma doação](#62-registrar-uma-doação)
7. [Desligando o sistema](#7-desligando-o-sistema)
8. [Perguntas frequentes](#8-perguntas-frequentes)

---

## 1. Ligando o sistema

O BiblioFlow roda dentro do Docker — um programa que isola o sistema em contêineres, sem precisar instalar mais nada na sua máquina.

**Passo a passo:**

1. Abra o **Docker Desktop** (o ícone aparece na barra de tarefas ou no menu de aplicativos).
2. Aguarde até que o canto inferior esquerdo do Docker Desktop exiba **"Engine running"** com um ícone verde.
3. Abra a pasta do projeto no seu computador.
4. Dentro da pasta, clique com o botão direito em um espaço vazio e escolha **"Abrir no Terminal"** (ou "Open in Terminal" / "Git Bash Here", dependendo do seu sistema).
5. Na janela do terminal que abrir, digite o comando abaixo e pressione **Enter**:

```
docker compose up --build
```

> **Na primeira vez**, o sistema vai baixar e montar os componentes — isso pode levar de 2 a 5 minutos dependendo da sua conexão. Nas próximas vezes, será muito mais rápido.

6. Aguarde até ver as mensagens abaixo no terminal. Elas confirmam que tudo está funcionando:

```
biblioflow-api  | 🚀 Servidor rodando na porta 3000
biblioflow-web  | ...ready
```

O sistema estará pronto quando essas mensagens aparecerem. **Não feche o terminal** enquanto o BiblioFlow estiver em uso.

---

## 2. Abrindo o BiblioFlow no navegador

Com o sistema ligado, abra qualquer navegador (Chrome, Firefox, Edge) e acesse:

```
http://localhost:4200
```

Você verá a tela de login do BiblioFlow.

> Se a tela não aparecer, aguarde mais alguns segundos e tente atualizar a página (F5).

---

## 3. Criando a conta do Gestor

O Gestor é quem administra o acervo: cadastra livros, registra locações e acompanha devoluções. É necessário criar pelo menos uma conta de Gestor antes de começar.

1. Na tela de login, clique em **"Cadastrar gestor"**.
2. Preencha os campos:
   - **Nome completo** — seu nome como aparecerá no sistema
   - **Telefone** — número de contato
   - **E-mail** — será usado para entrar no sistema (ex.: `gestor@bibliotekaipb.com`)
   - **Senha** — mínimo de 6 caracteres
3. Clique em **"Cadastrar"**.
4. Você será redirecionado automaticamente para o Painel do Gestor.

> O e-mail e a senha informados aqui serão as suas credenciais de acesso. Guarde-os em um lugar seguro.

---

## 4. Painel do Gestor

Após entrar, você verá o painel administrativo. Do lado esquerdo da tela há uma barra de navegação com os seguintes itens:

| Item na barra lateral | Para que serve |
|---|---|
| **Dashboard** | Visão geral do acervo e das locações |
| **Exemplares** | Cadastrar, consultar, editar e excluir livros |
| **Todas** (Locações) | Lista de todas as locações (ativas e finalizadas) |
| **Pendentes** | Locações que ultrapassaram a data de devolução |
| **Meu Perfil** | Dados da sua conta |
| **Sair** | Encerrar a sessão |

No canto superior direito aparece o seu nome e as iniciais no avatar.

---

### 4.1 Dashboard

O Dashboard é a primeira tela exibida após o login. Ele mostra um resumo em três cartões:

- **Exemplares cadastrados** — total de livros no acervo
- **Locações ativas** — quantos livros estão emprestados no momento
- **Devoluções pendentes** — locações que já passaram da data de entrega (aparece em destaque vermelho quando há alguma)

Abaixo dos cartões há atalhos rápidos para as ações mais comuns:

- **+ Cadastrar exemplar** — abre o formulário de novo livro
- **Listar exemplares** — vai para a lista do acervo
- **+ Nova locação** — abre o formulário de empréstimo
- **Ver pendências** — vai para a lista de atrasos

Clique em **"Atualizar"** (canto superior direito da seção) para recarregar os números.

---

### 4.2 Cadastrar um livro

1. Na barra lateral, clique em **"Exemplares"**.
2. Clique no botão **"+ Novo exemplar"** (canto superior direito).
3. Preencha o formulário:
   - **Título** — nome do livro (obrigatório, mínimo 2 caracteres)
   - **Autor** — nome do autor (obrigatório)
   - **Quantidade em estoque** — quantos exemplares físicos a biblioteca possui (mínimo 1)
   - **Descrição** — sinopse, edição ou observações sobre o livro (obrigatório)
4. Clique em **"Cadastrar exemplar"**.

> O **código de registro** é gerado automaticamente pelo sistema após o cadastro. Você verá ele logo na tela de detalhes do livro, no formato `BIB-XXXXXX-YYYYYY`. Esse código é único e identifica o exemplar no acervo.

Após salvar, o livro aparecerá na lista de exemplares.

---

### 4.2.1 Cadastrar um livro pelo ISBN (mais rápido)

O ISBN é o número de 10 ou 13 dígitos impresso perto do código de barras, na contracapa. Em vez de digitar tudo à mão, o sistema pode buscar os dados do livro para você.

1. Na tela **"Novo exemplar"**, use o campo **"Buscar por ISBN"**, no topo do formulário.
2. Digite o ISBN — pode ser com ou sem hífens, tanto faz (`978-85-359-0277-8` ou `9788535902778`).
3. Clique em **"Buscar dados"**.
4. Título, autor e descrição são preenchidos automaticamente, e a capa aparece ao lado quando existe.
5. **Confira e ajuste o que quiser** — todos os campos continuam editáveis. Informe a quantidade de exemplares.
6. Clique em **"Cadastrar exemplar"**.

**O que pode acontecer:**

| Situação | O que o sistema faz |
|---|---|
| Livro encontrado | Preenche os campos e mostra a capa |
| **Livro já cadastrado** no acervo | Avisa e oferece um link para o exemplar existente. Se você cadastrar mesmo assim, o sistema **soma** ao estoque em vez de duplicar |
| ISBN digitado errado | Avisa "ISBN inválido" — confira o número |
| Livro não encontrado na base | Avisa e você preenche manualmente, como no passo 4.2 |
| Sem internet no servidor | Avisa que o serviço está indisponível; o cadastro manual continua funcionando |

> A busca consulta três bases públicas e gratuitas, nesta ordem: a **Open Library** (internacional, é a que costuma trazer capa e sinopse), a **Agência Brasileira do ISBN / CBL** (edições nacionais, via BrasilAPI) e o **Google Books**. Livros brasileiros normalmente vêm da CBL — com título, autor, editora e ano, mas geralmente **sem capa e sem sinopse**, então vale escrever uma descrição própria antes de salvar. Se nenhuma das três conhecer o livro, é só preencher à mão. O **código de registro** continua sendo gerado pelo sistema; ele não é o ISBN.

---

### 4.3 Consultar e editar um livro

**Para consultar:**

1. Clique em **"Exemplares"** na barra lateral.
2. Na lista, use a **barra de busca** para encontrar um livro pelo título, autor ou código de registro.
3. Clique no livro desejado na tabela para ver os detalhes completos: código de registro, quantidade, data de cadastro e descrição.

**Para editar:**

1. Abra a tela de detalhes do livro (conforme acima).
2. Clique em **"Editar"** (canto superior direito).
3. Altere os campos desejados — título, autor, quantidade ou descrição.
4. Clique em **"Salvar alterações"**.

> O código de registro não pode ser alterado após o cadastro.

---

### 4.4 Excluir um livro

1. Abra a tela de detalhes do livro.
2. Clique no botão **"Excluir"** (em vermelho, canto superior direito).
3. Uma janela de confirmação aparecerá perguntando se você tem certeza.
4. Clique em **"Excluir definitivamente"** para confirmar, ou **"Cancelar"** para voltar.

> Um livro **não pode ser excluído** se tiver locações ativas. O sistema exibirá uma mensagem de aviso. Nesse caso, finalize a devolução do livro antes de excluí-lo.

---

### 4.5 Registrar uma locação

Uma locação registra o empréstimo de um livro para um membro da comunidade.

**Pré-requisito:** o membro precisa ter uma conta de Usuário no sistema. Veja como criar em [Cadastrando um Usuário](#5-cadastrando-um-usuário-membro).

1. Na barra lateral, clique em **"Todas"** (seção Locações) e depois em **"+ Nova locação"**, ou use o atalho no Dashboard.
2. O formulário tem três etapas:

**Etapa 1 — Livro:**
- Digite ao menos 2 letras do título na barra de busca.
- Uma lista de sugestões aparecerá. Clique no livro desejado para selecioná-lo.
- O sistema mostrará o título, autor, código de registro e quantidade em estoque.
- Se precisar trocar o livro, clique em **"Trocar"**.

**Etapa 2 — Usuário:**
- Cole o **ID do usuário** no campo indicado.
- O ID é um código longo no formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. Ele é exibido para o próprio usuário na tela de perfil dele, ou pode ser anotado no momento do cadastro.

**Etapa 3 — Período:**
- Selecione o período de empréstimo: **15 dias**, **30 dias** ou **45 dias**.
- O campo **"Devolução prevista para"** calcula e exibe automaticamente a data de entrega.

3. Clique em **"Criar locação"**.

> Se o livro estiver sem exemplares disponíveis, ou se o usuário já atingiu o limite de empréstimos simultâneos (3 por padrão), o sistema exibirá uma mensagem de aviso e a locação não será criada.

---

### 4.6 Devolver um livro (finalizar locação)

Quando um membro devolve um livro, registre a devolução no sistema:

1. Na barra lateral, clique em **"Todas"** (seção Locações).
2. Localize a locação na tabela — use o filtro de status **"Ativas"** para ver apenas os empréstimos em andamento.
3. Clique na locação para abrir os detalhes.
4. Clique no botão **"✓ Finalizar devolução"** (canto superior direito).
5. Uma janela de confirmação aparecerá mostrando o nome do livro. Clique em **"Confirmar devolução"**.

O sistema registra automaticamente a data e hora da devolução. Se o livro for devolvido depois da data prevista, a locação será marcada como **"Atrasada"** e aparecerá com uma etiqueta em vermelho.

> O botão "Finalizar devolução" só aparece em locações com status **Ativa**. Locações já finalizadas não podem ser reabertas.

---

### 4.7 Ver devoluções em atraso

1. Na barra lateral, clique em **"Pendentes"** (seção Locações).
2. A lista exibe todas as locações **ativas** que já ultrapassaram a data de devolução, ordenadas da mais antiga para a mais recente.
3. Clique em qualquer locação para ver os detalhes e realizar a devolução.

> O cartão **"Devoluções pendentes"** no Dashboard também mostra quantas locações estão em atraso. Quando o número é maior que zero, o cartão fica destacado em vermelho como alerta.

---

### 4.8 Meu Perfil

1. Na barra lateral, clique em **"Meu Perfil"**.
2. A tela exibe seu nome completo, e-mail, telefone e data de cadastro.

---

## 5. Cadastrando um Usuário (membro)

Usuários são os membros da comunidade que pegam livros emprestados ou doam livros. Qualquer pessoa pode criar sua própria conta pela tela de login, sem depender do Gestor.

**O usuário cria sua própria conta:**

1. Acesse `http://localhost:4200` no navegador.
2. Na tela de login, clique em **"Cadastrar usuário"**.
3. Preencha os campos:
   - **Nome completo**
   - **Telefone**
   - **CPF** — será usado para entrar no sistema (somente números, ex.: `12345678901`)
   - **Senha** — mínimo de 6 caracteres
4. Clique em **"Cadastrar"**.

Após o cadastro, o usuário entra automaticamente no sistema com acesso ao catálogo e ao formulário de doações.

> **Importante para o Gestor:** para registrar uma locação em nome de um usuário, você precisará do **ID** do usuário — um código gerado automaticamente no cadastro. Peça ao usuário para acessar **"Meu Perfil"** e anotar esse código para você.

---

## 6. O que o Usuário pode fazer

O Usuário tem acesso a um ambiente simplificado, diferente do painel do Gestor.

---

### 6.1 Catálogo de livros

1. Após o login com CPF e senha, o Usuário é direcionado automaticamente para o **Catálogo**.
2. A tela exibe os livros disponíveis no acervo em forma de lista ou grade.
3. Use a **barra de busca** para filtrar por título, autor ou código de registro.
4. Clique em um livro para ver todos os detalhes: descrição, autor, quantidade disponível e código de registro.

> O Usuário pode consultar o acervo, mas apenas o Gestor pode registrar empréstimos.

---

### 6.2 Registrar uma doação

Qualquer Usuário autenticado pode registrar a doação de um livro para o acervo:

1. Na barra de navegação superior, clique em **"Doações"**.
2. Se o livro doado já existir no catálogo:
   - Digite o título no campo **"Buscar no catálogo"**.
   - Selecione o livro na lista que aparecer — os campos de título e autor serão preenchidos automaticamente.
3. Se o livro for novo (não está no catálogo ainda):
   - Deixe a busca em branco.
   - Preencha manualmente os campos **Título** e **Autor**.
4. Clique em **"Registrar doação"**.

> A doação apenas registra a intenção de entregar o livro. O Gestor é responsável por receber o exemplar físico e, se necessário, cadastrá-lo no acervo.

---

## 7. Desligando o sistema

Quando terminar de usar o BiblioFlow, volte ao terminal onde o sistema está rodando e pressione as teclas **Ctrl + C** ao mesmo tempo. O terminal exibirá mensagens indicando que os contêineres foram encerrados.

> Todos os dados (livros, locações, usuários) ficam salvos no banco de dados mesmo depois de desligar o sistema. Na próxima vez, basta rodar `docker compose up` novamente — sem o `--build`, que é necessário somente na primeira vez.

---

## 8. Perguntas frequentes

**A tela não abre no navegador. O que fazer?**
Verifique se o Docker Desktop está aberto e com o status "Engine running" (ícone verde). Confira também se o terminal ainda está rodando — se tiver sido fechado acidentalmente, execute `docker compose up` novamente.

---

**Esqueci a senha. Como recuperar?**
No momento, o sistema não possui função de recuperação de senha por e-mail. Se o Gestor esquecer a senha, será necessário criar uma nova conta de Gestor. Se um Usuário esquecer, o mesmo se aplica.

---

**Tentei criar uma locação mas recebi uma mensagem de erro. Por quê?**
Existem três situações que impedem a criação de uma locação:

- **Sem exemplares disponíveis** — todos os exemplares do livro já estão emprestados. Aguarde uma devolução.
- **Usuário atingiu o limite** — o usuário já tem 3 locações ativas simultaneamente. Finalize uma delas antes de criar uma nova.
- **ID de usuário incorreto** — confirme o ID com o usuário (disponível em "Meu Perfil" na conta do usuário).

---

**Tentei excluir um livro mas recebi erro. Por quê?**
O sistema não permite excluir livros que possuam locações ativas. Finalize a devolução de todos os exemplares do livro antes de excluí-lo.

---

**Os dados somem quando desligo o Docker. O que está acontecendo?**
Isso não deveria acontecer. Verifique se o arquivo `.env` existe na pasta do projeto (baseado no `.env.example`). Se o problema persistir, certifique-se de que o Docker está usando o `docker-compose.yml` correto, que mantém os dados em um volume persistente.

---

**Quero usar o sistema em outro computador da mesma rede. É possível?**
Sim. Outros computadores na mesma rede podem acessar o BiblioFlow pelo endereço IP do computador onde o Docker está rodando, no lugar de `localhost`. Exemplo: se o IP do computador host for `192.168.1.10`, acesse `http://192.168.1.10:4200` nos outros dispositivos.
