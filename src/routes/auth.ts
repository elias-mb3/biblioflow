import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { registerSchema, loginSchema } from '../schemas/auth';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), authController.register);
authRouter.post('/login', validate(loginSchema), authController.login);
