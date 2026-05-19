import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { RegisterInput, LoginInput } from '../schemas/auth';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body as RegisterInput);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body as LoginInput);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
