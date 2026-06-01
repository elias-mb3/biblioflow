import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class PerfilComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly initials = computed(() => {
    const name = this.auth.user()?.fullName ?? this.auth.payload()?.sub ?? 'BF';
    return name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  });

  readonly tokenIssuedAt = computed(() => {
    const iat = this.auth.payload()?.iat;
    return iat ? new Date(iat * 1000) : null;
  });

  readonly tokenExpiresAt = computed(() => {
    const exp = this.auth.payload()?.exp;
    return exp ? new Date(exp * 1000) : null;
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  attemptPasswordChange(): void {
    this.toast.warning(
      'Funcionalidade indisponível',
      'O endpoint PATCH /auth/me ainda não foi implementado na API.',
    );
  }
}
