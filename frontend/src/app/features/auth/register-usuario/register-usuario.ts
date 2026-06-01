import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiError } from '../../../core/models/api-error.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register-usuario',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register-usuario.html',
  styleUrl: './register-usuario.css',
})
export class RegisterUsuarioComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    phone: ['', [Validators.required, Validators.minLength(10)]],
    cpf: ['', [Validators.required, Validators.minLength(11)]],
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
        cpf: value.cpf,
        password: value.password,
        role: 'USER',
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

  fieldInvalid(name: 'fullName' | 'phone' | 'cpf' | 'password'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }
}
