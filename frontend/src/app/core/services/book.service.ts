import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Book,
  BookSearchParams,
  CreateBookRequest,
  PaginatedBooks,
  UpdateBookRequest,
} from '../models/book.model';

@Injectable({ providedIn: 'root' })
export class BookService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/books`;

  list(page = 1): Observable<PaginatedBooks> {
    const params = new HttpParams().set('page', page);
    return this.http.get<PaginatedBooks>(this.baseUrl, { params });
  }

  search(query: BookSearchParams, page = 1): Observable<PaginatedBooks> {
    let params = new HttpParams().set('page', page);
    if (query.title) params = params.set('title', query.title);
    if (query.author) params = params.set('author', query.author);
    if (query.registrationCode) params = params.set('registrationCode', query.registrationCode);
    return this.http.get<PaginatedBooks>(`${this.baseUrl}/search`, { params });
  }

  getById(id: string): Observable<Book> {
    return this.http.get<Book>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateBookRequest): Observable<Book> {
    return this.http.post<Book>(this.baseUrl, data);
  }

  update(id: string, data: UpdateBookRequest): Observable<Book> {
    return this.http.put<Book>(`${this.baseUrl}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
