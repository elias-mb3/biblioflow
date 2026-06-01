import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateDonationRequest, Donation } from '../models/donation.model';

@Injectable({ providedIn: 'root' })
export class DonationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/donations`;

  create(data: CreateDonationRequest): Observable<Donation> {
    return this.http.post<Donation>(this.baseUrl, data);
  }
}
