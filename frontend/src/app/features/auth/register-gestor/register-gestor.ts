import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { ApiError } from '../../../core/models/api-error.model';

@Component({
  selector: 'app-register-gestor',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register-gestor.html',
  styleUrl: './register-gestor.css',
})
export class RegisterGestorComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.fieldErrors.set([]);

    const value = this.form.getRawValue();
    this.auth
      .register({
        fullName: value.fullName,
        phone: value.phone,
        email: value.email,
        password: value.password,
        role: 'MANAGER',
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.auth.redirectByRole();
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          const body = err.error as ApiError | undefined;
          this.errorMessage.set(body?.erro ?? 'Não foi possível concluir o cadastro.');
          this.fieldErrors.set(body?.detalhes ?? []);
        },
      });
  }

  fieldInvalid(name: 'fullName' | 'phone' | 'email' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }
}
