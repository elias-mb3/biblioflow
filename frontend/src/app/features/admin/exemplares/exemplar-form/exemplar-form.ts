import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../../core/models/api-error.model';
import { BookService } from '../../../../core/services/book.service';
import { ToastService } from '../../../../core/services/toast.service';
import { SpinnerComponent } from '../../../../shared/components/spinner/spinner';

@Component({
  selector: 'app-exemplar-form',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent],
  templateUrl: './exemplar-form.html',
  styleUrl: './exemplar-form.css',
})
export class ExemplarFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly bookId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly editing = computed(() => this.bookId() !== null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<string[]>([]);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    author: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(4)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    if (this.editing()) {
      this.loadBook();
    }
  }

  private loadBook(): void {
    const id = this.bookId();
    if (!id) return;
    this.loading.set(true);
    this.bookService.getById(id).subscribe({
      next: (book) => {
        this.form.patchValue({
          title: book.title,
          author: book.author,
          description: book.description,
          quantity: book.quantity,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Exemplar não encontrado');
        this.router.navigate(['/admin/exemplares']);
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.fieldErrors.set([]);

    const data = this.form.getRawValue();
    const id = this.bookId();

    const obs = id ? this.bookService.update(id, data) : this.bookService.create(data);
    obs.subscribe({
      next: (book) => {
        this.saving.set(false);
        if (id) {
          this.toast.success('Exemplar atualizado', `${book.title} foi atualizado.`);
        } else {
          this.toast.success(
            'Exemplar cadastrado',
            `Código gerado: ${book.registrationCode}`,
          );
        }
        this.router.navigate(['/admin/exemplares', book.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const body = err.error as ApiError | undefined;
        this.errorMessage.set(body?.erro ?? 'Não foi possível salvar o exemplar.');
        this.fieldErrors.set(body?.detalhes ?? []);
      },
    });
  }

  fieldInvalid(name: 'title' | 'author' | 'description' | 'quantity'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }
}
