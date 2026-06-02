import { OpenAPIV3 } from 'openapi-types';

const bearerAuth: OpenAPIV3.SecuritySchemeObject = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
};

// ── Reusable schemas ────────────────────────────────────────────────────────

const errorResponse: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    erro: { type: 'string', example: 'Mensagem de erro legível' },
    detalhes: { type: 'array', items: { type: 'string' } },
  },
};

const userSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    role: { type: 'string', enum: ['MANAGER', 'USER'] },
    fullName: { type: 'string' },
    phone: { type: 'string' },
    email: { type: 'string', format: 'email', nullable: true },
    cpf: { type: 'string', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const bookSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    registrationCode: { type: 'string', example: 'BIB-LKZP3A4-C9F2E1' },
    title: { type: 'string' },
    description: { type: 'string' },
    author: { type: 'string' },
    quantity: { type: 'integer', minimum: 1 },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const rentalSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    bookId: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    periodDays: { type: 'integer', enum: [15, 30, 45] },
    startDate: { type: 'string', format: 'date-time' },
    dueDate: { type: 'string', format: 'date-time' },
    returnDate: { type: 'string', format: 'date-time', nullable: true },
    status: { type: 'string', enum: ['ACTIVE', 'FINALIZED'] },
    late: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

const donationSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    bookId: { type: 'string', format: 'uuid', nullable: true },
    title: { type: 'string' },
    author: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

// ── Pagination wrapper ───────────────────────────────────────────────────────

function paginated(itemRef: string): OpenAPIV3.SchemaObject {
  return {
    type: 'object',
    properties: {
      items: { type: 'array', items: { $ref: itemRef } },
      total: { type: 'integer' },
      page: { type: 'integer' },
      pages: { type: 'integer' },
    },
  };
}

// ── Responses helpers ────────────────────────────────────────────────────────

function jsonResponse(
  description: string,
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.ResponseObject {
  return {
    description,
    content: { 'application/json': { schema } },
  };
}

const errorResponses: Record<string, OpenAPIV3.ResponseObject> = {
  400: jsonResponse('Dados inválidos', errorResponse),
  401: jsonResponse('Não autenticado', errorResponse),
  403: jsonResponse('Sem permissão', errorResponse),
  404: jsonResponse('Não encontrado', errorResponse),
  409: jsonResponse('Conflito de negócio', errorResponse),
};

// ── Spec ────────────────────────────────────────────────────────────────────

export const openapiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'BiblioFlow API',
    version: '1.0.0',
    description:
      'API REST para gerenciamento de acervo comunitário — Igreja Presbiteriana do Brasil (IPB). ' +
      'Registra livros, controla locações e aceita doações.\n\n' +
      '**Como autenticar:** use `POST /auth/login` para obter um JWT e clique em **Authorize** (🔒) ' +
      'para colá-lo. Todos os endpoints marcados com 🔒 requerem o token; os marcados com 👤 ' +
      'exigem perfil **MANAGER**.',
    contact: { name: 'BiblioFlow', email: 'e.monteiro.b3@gmail.com' },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api/v1', description: 'Local dev' }],
  components: {
    securitySchemes: { bearerAuth },
    schemas: {
      User: userSchema,
      Book: bookSchema,
      Rental: rentalSchema,
      Donation: donationSchema,
      Error: errorResponse,
    },
  },
  tags: [
    { name: 'Auth', description: 'Registro e login' },
    { name: 'Usuários', description: 'Gestão de leitores pelo gestor' },
    { name: 'Livros', description: 'Catálogo de livros' },
    { name: 'Locações', description: 'Controle de locações e devoluções' },
    { name: 'Doações', description: 'Registro de doações' },
  ],
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar usuário',
        description: 'Cria um novo usuário. **MANAGER** requer `email`; **USER** requer `cpf`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role', 'fullName', 'phone', 'password'],
                properties: {
                  role: { type: 'string', enum: ['MANAGER', 'USER'] },
                  fullName: { type: 'string', minLength: 2, example: 'Ana Lima' },
                  phone: { type: 'string', minLength: 8, example: '11987654321' },
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'ana@biblioflow.com',
                    description: 'Obrigatório para MANAGER',
                  },
                  cpf: {
                    type: 'string',
                    example: '12345678901',
                    description: 'Obrigatório para USER',
                  },
                  password: { type: 'string', minLength: 6, example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Usuário criado', {
            type: 'object',
            properties: {
              message: { type: 'string' },
              user: { $ref: '#/components/schemas/User' },
            },
          }),
          400: errorResponses[400],
          409: errorResponses[409],
        },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        description:
          'Autentica e retorna um JWT. Use **email** como `identifier` para MANAGER; use **CPF** para USER.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['identifier', 'password'],
                properties: {
                  identifier: {
                    type: 'string',
                    example: 'manager@biblioflow.com',
                    description: 'E-mail (MANAGER) ou CPF (USER)',
                  },
                  password: { type: 'string', example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Token JWT', {
            type: 'object',
            properties: { token: { type: 'string' } },
          }),
          400: errorResponses[400],
          401: errorResponses[401],
        },
      },
    },

    // ── Users ─────────────────────────────────────────────────────────────

    '/users': {
      get: {
        tags: ['Usuários'],
        summary: '👤 Listar leitores (paginado)',
        description: 'Lista usuários com perfil USER. Busca opcional por nome ou CPF via `q`.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Termo de busca por nome ou CPF',
            schema: { type: 'string', example: 'Ana' },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: jsonResponse('Lista paginada', paginated('#/components/schemas/User')),
          401: errorResponses[401],
          403: errorResponses[403],
        },
      },
      post: {
        tags: ['Usuários'],
        summary: '👤 Cadastrar leitor',
        description: 'Cria um usuário com perfil USER. Não retorna token nem o hash da senha.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'phone', 'cpf', 'password'],
                properties: {
                  fullName: { type: 'string', minLength: 2, example: 'Ana Lima' },
                  phone: { type: 'string', minLength: 8, example: '11987654321' },
                  cpf: { type: 'string', example: '12345678901' },
                  password: { type: 'string', minLength: 6, example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Leitor criado', { $ref: '#/components/schemas/User' }),
          400: errorResponses[400],
          401: errorResponses[401],
          403: errorResponses[403],
          409: errorResponses[409],
        },
      },
    },

    '/users/{id}': {
      get: {
        tags: ['Usuários'],
        summary: '👤 Detalhe do leitor',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: jsonResponse('Usuário', { $ref: '#/components/schemas/User' }),
          401: errorResponses[401],
          403: errorResponses[403],
          404: errorResponses[404],
        },
      },
    },

    // ── Books ─────────────────────────────────────────────────────────────

    '/books': {
      get: {
        tags: ['Livros'],
        summary: '🔒 Listar livros (paginado)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: {
          200: jsonResponse('Lista paginada', paginated('#/components/schemas/Book')),
          401: errorResponses[401],
        },
      },
      post: {
        tags: ['Livros'],
        summary: '👤 Criar livro',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description', 'author'],
                properties: {
                  title: { type: 'string', example: 'O Senhor dos Anéis' },
                  description: { type: 'string', example: 'Épico de fantasia de Tolkien.' },
                  author: { type: 'string', example: 'J.R.R. Tolkien' },
                  quantity: { type: 'integer', minimum: 1, default: 1 },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Livro criado', { $ref: '#/components/schemas/Book' }),
          400: errorResponses[400],
          401: errorResponses[401],
          403: errorResponses[403],
        },
      },
    },

    '/books/search': {
      get: {
        tags: ['Livros'],
        summary: '🔒 Buscar livros',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Termo de busca',
            schema: { type: 'string', example: 'Tolkien' },
          },
          {
            name: 'field',
            in: 'query',
            description: 'Campo de busca',
            schema: { type: 'string', enum: ['title', 'author', 'registrationCode'] },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: jsonResponse('Resultados', paginated('#/components/schemas/Book')),
          401: errorResponses[401],
        },
      },
    },

    '/books/{id}': {
      get: {
        tags: ['Livros'],
        summary: '🔒 Detalhe do livro',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: jsonResponse('Livro', { $ref: '#/components/schemas/Book' }),
          401: errorResponses[401],
          404: errorResponses[404],
        },
      },
      put: {
        tags: ['Livros'],
        summary: '👤 Atualizar livro',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  author: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse('Livro atualizado', { $ref: '#/components/schemas/Book' }),
          400: errorResponses[400],
          401: errorResponses[401],
          403: errorResponses[403],
          404: errorResponses[404],
        },
      },
      delete: {
        tags: ['Livros'],
        summary: '👤 Remover livro',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          204: { description: 'Removido com sucesso' },
          401: errorResponses[401],
          403: errorResponses[403],
          404: errorResponses[404],
          409: errorResponses[409],
        },
      },
    },

    // ── Rentals ───────────────────────────────────────────────────────────

    '/rentals': {
      get: {
        tags: ['Locações'],
        summary: '👤 Listar locações',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['ACTIVE', 'FINALIZED'] },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: jsonResponse('Lista paginada', paginated('#/components/schemas/Rental')),
          401: errorResponses[401],
          403: errorResponses[403],
        },
      },
      post: {
        tags: ['Locações'],
        summary: '👤 Criar locação',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['bookId', 'userId', 'periodDays'],
                properties: {
                  bookId: { type: 'string', format: 'uuid' },
                  userId: { type: 'string', format: 'uuid' },
                  periodDays: {
                    type: 'integer',
                    enum: [15, 30, 45],
                    description: 'Apenas 15, 30 ou 45 dias são aceitos',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Locação criada', { $ref: '#/components/schemas/Rental' }),
          400: errorResponses[400],
          401: errorResponses[401],
          403: errorResponses[403],
          404: errorResponses[404],
          409: errorResponses[409],
        },
      },
    },

    '/rentals/pending': {
      get: {
        tags: ['Locações'],
        summary: '👤 Locações com prazo vencido',
        description:
          'Retorna locações `ACTIVE` cuja `dueDate` já passou, ordenadas por prazo crescente.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse('Locações pendentes', {
            type: 'array',
            items: { $ref: '#/components/schemas/Rental' },
          }),
          401: errorResponses[401],
          403: errorResponses[403],
        },
      },
    },

    '/rentals/{id}': {
      get: {
        tags: ['Locações'],
        summary: '👤 Detalhe da locação',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: jsonResponse('Locação com livro e usuário', { $ref: '#/components/schemas/Rental' }),
          401: errorResponses[401],
          403: errorResponses[403],
          404: errorResponses[404],
        },
      },
    },

    '/rentals/{id}/finalize': {
      patch: {
        tags: ['Locações'],
        summary: '👤 Finalizar locação (devolução)',
        description:
          'Registra a devolução. Se `returnDate > dueDate`, marca `late = true`. ' +
          'Finalizar uma locação já `FINALIZED` retorna 409.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: jsonResponse('Locação finalizada', { $ref: '#/components/schemas/Rental' }),
          401: errorResponses[401],
          403: errorResponses[403],
          404: errorResponses[404],
          409: errorResponses[409],
        },
      },
    },

    // ── Donations ─────────────────────────────────────────────────────────

    '/donations': {
      post: {
        tags: ['Doações'],
        summary: '🔒 Registrar doação',
        description: 'Qualquer usuário autenticado pode registrar uma doação. `bookId` é opcional.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'title', 'author'],
                properties: {
                  userId: { type: 'string', format: 'uuid', description: 'ID do doador' },
                  title: { type: 'string', example: 'Dom Quixote' },
                  author: { type: 'string', example: 'Miguel de Cervantes' },
                  bookId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description: 'ID do livro no catálogo, se já cadastrado',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: jsonResponse('Doação registrada', { $ref: '#/components/schemas/Donation' }),
          400: errorResponses[400],
          401: errorResponses[401],
          404: errorResponses[404],
        },
      },
    },
  },
};
