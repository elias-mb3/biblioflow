import { Request, Response, NextFunction } from 'express';
import { donationService } from '../services/donation.service';
import { CreateDonationInput } from '../schemas/donation';

export const donationController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const donation = await donationService.create(req.body as CreateDonationInput);
      res.status(201).json(donation);
    } catch (err) {
      next(err);
    }
  },
};
