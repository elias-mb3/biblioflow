import { Router } from 'express';
import { rentalController } from '../controllers/rental.controller';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createRentalSchema } from '../schemas/rental';

export const rentalsRouter = Router();

rentalsRouter.use(authenticate, requireRole('MANAGER'));

rentalsRouter.get('/', rentalController.list);
rentalsRouter.get('/pending', rentalController.listPending);
rentalsRouter.get('/:id', rentalController.getById);
rentalsRouter.post('/', validate(createRentalSchema), rentalController.create);
rentalsRouter.patch('/:id/finalize', rentalController.finalize);
