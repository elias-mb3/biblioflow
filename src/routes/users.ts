import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createUserSchema } from '../schemas/user';

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole('MANAGER'));

usersRouter.get('/', userController.list);
usersRouter.get('/:id', userController.getById);
usersRouter.post('/', validate(createUserSchema), userController.create);
