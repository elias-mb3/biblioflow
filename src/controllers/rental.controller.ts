import { Request, Response, NextFunction } from 'express';
import { rentalService } from '../services/rental.service';
import { listRentalsSchema } from '../schemas/rental';
import { RentalStatus } from '../generated/prisma/client';

export const rentalController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = listRentalsSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ erro: 'Parâmetros inválidos', detalhes: parsed.error.errors });
        return;
      }
      const result = await rentalService.list({
        status: parsed.data.status as RentalStatus | undefined,
        page: parsed.data.page,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const rental = await rentalService.getById(req.params.id);
      res.json(rental);
    } catch (err) {
      next(err);
    }
  },

  async listPending(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(String(req.query.page ?? '1'), 10);
      const result = await rentalService.listPending(page);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const rental = await rentalService.create(req.body);
      res.status(201).json(rental);
    } catch (err) {
      next(err);
    }
  },

  async finalize(req: Request, res: Response, next: NextFunction) {
    try {
      const rental = await rentalService.finalize(req.params.id);
      res.json(rental);
    } catch (err) {
      next(err);
    }
  },
};
