import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Paginated } from '../models/pagination.model';
import { CreateUserRequest, User } from '../models/user.model';

export type PaginatedUsers = Paginated<User>;

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  list(page = 1): Observable<PaginatedUsers> {
    const params = new HttpParams().set('page', page);
    return this.http.get<PaginatedUsers>(this.baseUrl, { params });
  }

  search(q: string, page = 1): Observable<PaginatedUsers> {
    const params = new HttpParams().set('q', q).set('page', page);
    return this.http.get<PaginatedUsers>(this.baseUrl, { params });
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, data);
  }
}
