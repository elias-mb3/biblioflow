import { Request, Response, NextFunction } from 'express';
import { bookService } from '../services/book.service';
import { bookSearchSchema } from '../schemas/book';

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
        res.status(400).json({ erro: 'Parâmetros inválidos', detalhes: parsed.error.errors });
        return;
      }
      const result = await bookService.search(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const book = await bookService.getById(req.params.id);
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
      const book = await bookService.update(req.params.id, req.body);
      res.json(book);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await bookService.delete(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
