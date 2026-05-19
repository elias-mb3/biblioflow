import { Router } from 'express';
import { donationController } from '../controllers/donation.controller';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createDonationSchema } from '../schemas/donation';

export const donationsRouter = Router();

donationsRouter.use(authenticate);

donationsRouter.post('/', validate(createDonationSchema), donationController.create);
