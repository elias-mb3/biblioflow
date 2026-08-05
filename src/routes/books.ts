import { Router } from 'express';
import { bookController } from '../controllers/book.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { isbnLookupRateLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';
import { createBookFromIsbnSchema, createBookSchema, updateBookSchema } from '../schemas/book';

export const booksRouter = Router();

booksRouter.use(authenticate);

booksRouter.get('/', bookController.list);
booksRouter.get('/search', bookController.search);

// As rotas /isbn precisam vir ANTES de /:id, senão `/books/isbn/978…` casa com
// o handler de getById e responde 404.
booksRouter.get(
  '/isbn/:isbn',
  requireRole('MANAGER'),
  isbnLookupRateLimiter,
  bookController.previewByIsbn,
);
booksRouter.post(
  '/isbn',
  requireRole('MANAGER'),
  isbnLookupRateLimiter,
  validate(createBookFromIsbnSchema),
  bookController.createFromIsbn,
);

booksRouter.get('/:id', bookController.getById);

booksRouter.post('/', requireRole('MANAGER'), validate(createBookSchema), bookController.create);
booksRouter.put('/:id', requireRole('MANAGER'), validate(updateBookSchema), bookController.update);
booksRouter.delete('/:id', requireRole('MANAGER'), bookController.delete);
