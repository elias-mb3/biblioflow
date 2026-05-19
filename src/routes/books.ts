import { Router } from 'express';
import { bookController } from '../controllers/book.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createBookSchema, updateBookSchema } from '../schemas/book';

export const booksRouter = Router();

booksRouter.use(authenticate);

booksRouter.get('/', bookController.list);
booksRouter.get('/search', bookController.search);
booksRouter.get('/:id', bookController.getById);

booksRouter.post('/', requireRole('MANAGER'), validate(createBookSchema), bookController.create);
booksRouter.put('/:id', requireRole('MANAGER'), validate(updateBookSchema), bookController.update);
booksRouter.delete('/:id', requireRole('MANAGER'), bookController.delete);
