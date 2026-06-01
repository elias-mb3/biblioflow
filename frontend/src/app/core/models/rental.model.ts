import { Book } from './book.model';
import { Paginated } from './pagination.model';
import { User } from './user.model';

export type RentalStatus = 'ACTIVE' | 'FINALIZED';

export type RentalPeriod = 15 | 30 | 45;

export const RENTAL_PERIODS: RentalPeriod[] = [15, 30, 45];

export interface Rental {
  id: string;
  bookId: string;
  userId: string;
  periodDays: RentalPeriod;
  startDate: string;
  dueDate: string;
  returnDate?: string;
  status: RentalStatus;
  late: boolean;
  createdAt: string;
  book?: Book;
  user?: User;
}

export type PaginatedRentals = Paginated<Rental>;

export interface CreateRentalRequest {
  bookId: string;
  userId: string;
  periodDays: RentalPeriod;
}
