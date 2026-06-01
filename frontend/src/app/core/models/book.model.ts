import { Paginated } from './pagination.model';

export interface Book {
  id: string;
  registrationCode: string;
  title: string;
  author: string;
  description: string;
  quantity: number;
  createdAt: string;
}

export type PaginatedBooks = Paginated<Book>;

export interface CreateBookRequest {
  title: string;
  author: string;
  description: string;
  quantity: number;
}

export type UpdateBookRequest = Partial<CreateBookRequest>;

export interface BookSearchParams {
  title?: string;
  author?: string;
  registrationCode?: string;
}
