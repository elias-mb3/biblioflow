import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { userSearchSchema } from '../schemas/user';

export const userController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = userSearchSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ erro: 'Parâmetros inválidos', detalhes: parsed.error.issues });
        return;
      }
      const result = await userService.list(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(String(req.params.id));
      res.json(user);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.create(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },
};
