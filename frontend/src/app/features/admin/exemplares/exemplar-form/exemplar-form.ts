import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../../core/models/api-error.model';
import { BookMetadata } from '../../../../core/models/book.model';
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

  readonly lookingUp = signal(false);
  readonly lookupError = signal<string | null>(null);
  readonly metadata = signal<BookMetadata | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    author: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(4)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    // Opcional: o cadastro manual sem ISBN continua válido (doações, edições antigas).
    isbn: [''],
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
          isbn: book.isbn ?? '',
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

    // ISBN em branco não pode ir no corpo: a API valida o formato quando o campo existe.
    const { isbn, ...rest } = this.form.getRawValue();
    const data = isbn.trim() ? { ...rest, isbn: isbn.trim() } : rest;
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

  fieldInvalid(name: 'title' | 'author' | 'description' | 'quantity' | 'isbn'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  /**
   * Busca os metadados do ISBN e preenche o formulário. Os campos continuam
   * editáveis: o gestor revisa antes de salvar.
   */
  lookupIsbn(): void {
    const isbn = this.form.controls.isbn.value.trim();
    if (!isbn || this.lookingUp()) return;

    this.lookingUp.set(true);
    this.lookupError.set(null);
    this.metadata.set(null);

    this.bookService.lookupByIsbn(isbn).subscribe({
      next: (data) => {
        this.lookingUp.set(false);
        this.metadata.set(data);
        this.form.patchValue({
          title: data.title,
          author: data.author,
          description: data.description,
          isbn: data.isbn,
        });

        if (data.alreadyRegistered) {
          this.toast.info(
            'Livro já cadastrado',
            `${data.title} já está no acervo. Salvar aqui criaria uma duplicata — prefira editar o exemplar existente.`,
          );
        } else {
          this.toast.success('Dados encontrados', `${data.title} — confira antes de salvar.`);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.lookingUp.set(false);
        this.lookupError.set(this.lookupErrorMessage(err));
      },
    });
  }

  /** Nenhum destes casos bloqueia o cadastro manual — só informa e devolve o controle. */
  private lookupErrorMessage(err: HttpErrorResponse): string {
    const fallback = (err.error as ApiError | undefined)?.erro;
    switch (err.status) {
      case 400:
        return 'ISBN inválido. Confira os dígitos e tente de novo.';
      case 404:
        return 'ISBN não encontrado na base de livros. Preencha os campos manualmente.';
      case 429:
        return 'Muitas consultas seguidas. Aguarde alguns instantes e tente de novo.';
      case 503:
        return 'Serviço de consulta indisponível no momento. Preencha os campos manualmente.';
      default:
        return fallback ?? 'Não foi possível consultar o ISBN. Preencha os campos manualmente.';
    }
  }
}
