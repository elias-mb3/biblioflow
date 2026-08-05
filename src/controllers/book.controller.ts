import { Request, Response, NextFunction } from 'express';
import { bookService } from '../services/book.service';
import { bookSearchSchema, isbnParamSchema } from '../schemas/book';

export const bookController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(String(req.query.page ?? '1'), 10);
      const result = await bookService.list(page);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = bookSearchSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ erro: 'Parâmetros inválidos', detalhes: parsed.error.issues });
        return;
      }
      const result = await bookService.search(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async previewByIsbn(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = isbnParamSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json({ erro: 'Parâmetros inválidos', detalhes: parsed.error.issues });
        return;
      }
      const preview = await bookService.previewByIsbn(parsed.data.isbn);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  },

  async createFromIsbn(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookService.createFromIsbn(req.body);
      // 200 quando somou ao estoque de um livro existente, 201 quando criou — ADR 0003.
      res.status(result.incremented ? 200 : 201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const book = await bookService.getById(String(req.params.id));
      res.json(book);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const book = await bookService.create(req.body);
      res.status(201).json(book);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const book = await bookService.update(String(req.params.id), req.body);
      res.json(book);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await bookService.delete(String(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
