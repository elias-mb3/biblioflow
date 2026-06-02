import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { optionalAuthenticate } from '../middlewares/auth';
import { registerSchema, loginSchema } from '../schemas/auth';

export const authRouter = Router();

authRouter.post(
  '/register',
  optionalAuthenticate,
  validate(registerSchema),
  authController.register,
);
authRouter.post('/login', validate(loginSchema), authController.login);
