import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateRentalRequest,
  PaginatedRentals,
  Rental,
  RentalStatus,
} from '../models/rental.model';

@Injectable({ providedIn: 'root' })
export class RentalService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rentals`;

  list(status?: RentalStatus, page = 1): Observable<PaginatedRentals> {
    let params = new HttpParams().set('page', page);
    if (status) params = params.set('status', status);
    return this.http.get<PaginatedRentals>(this.baseUrl, { params });
  }

  getPending(page = 1): Observable<PaginatedRentals> {
    const params = new HttpParams().set('page', page);
    return this.http.get<PaginatedRentals>(`${this.baseUrl}/pending`, { params });
  }

  getById(id: string): Observable<Rental> {
    return this.http.get<Rental>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateRentalRequest): Observable<Rental> {
    return this.http.post<Rental>(this.baseUrl, data);
  }

  finalize(id: string): Observable<Rental> {
    return this.http.patch<Rental>(`${this.baseUrl}/${id}/finalize`, {});
  }
}
