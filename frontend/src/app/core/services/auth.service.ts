import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AuthPayload,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Role,
  User,
} from '../models/user.model';

const TOKEN_KEY = 'biblioflow.token';
const USER_KEY = 'biblioflow.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(this.readToken());
  private readonly _user = signal<User | null>(this.readUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly payload = computed<AuthPayload | null>(() => this.decode(this._token()));
  readonly isLoggedIn = computed(() => {
    const p = this.payload();
    if (!p) return false;
    if (p.exp && Date.now() >= p.exp * 1000) return false;
    return true;
  });
  readonly role = computed<Role | null>(() => this.payload()?.role ?? null);

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, data)
      .pipe(tap((res) => this.persist(res)));
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap((res) => this.persist(res)));
  }

  logout(redirect = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    if (redirect) {
      this.router.navigate(['/login']);
    }
  }

  redirectByRole(): void {
    const role = this.role();
    if (role === 'MANAGER') {
      this.router.navigate(['/admin']);
    } else if (role === 'USER') {
      this.router.navigate(['/usuario']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  private persist(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
  }

  private readToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private readUser(): User | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private decode(token: string | null): AuthPayload | null {
    if (!token) return null;
    try {
      const [, payload] = token.split('.');
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as AuthPayload;
    } catch {
      return null;
    }
  }
}
