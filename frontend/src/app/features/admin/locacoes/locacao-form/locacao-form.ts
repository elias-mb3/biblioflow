import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

import { ApiError } from '../../../../core/models/api-error.model';
import { Book } from '../../../../core/models/book.model';
import { RENTAL_PERIODS, RentalPeriod } from '../../../../core/models/rental.model';
import { BookService } from '../../../../core/services/book.service';
import { RentalService } from '../../../../core/services/rental.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-locacao-form',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './locacao-form.html',
  styleUrl: './locacao-form.css',
})
export class LocacaoFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly rentalService = inject(RentalService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly periods = RENTAL_PERIODS;
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<string[]>([]);

  readonly bookSearch = new FormControl('', { nonNullable: true });
  readonly bookResults = signal<Book[]>([]);
  readonly searching = signal(false);
  readonly selectedBook = signal<Book | null>(null);

  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required, Validators.minLength(8)]],
    periodDays: [15 as RentalPeriod, [Validators.required]],
  });

  readonly previewDueDate = computed<Date | null>(() => {
    const period = this.form.controls.periodDays.value;
    if (!period) return null;
    const d = new Date();
    d.setDate(d.getDate() + Number(period));
    return d;
  });

  constructor() {
    this.bookSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.selectedBook.set(null);
          if (!term.trim() || term.length < 2) {
            this.bookResults.set([]);
            this.searching.set(false);
            return [];
          }
          this.searching.set(true);
          return this.bookService.search({ title: term.trim() });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => {
          this.bookResults.set(res.items);
          this.searching.set(false);
        },
        error: () => {
          this.searching.set(false);
          this.toast.error('Falha na busca de livros');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBook(book: Book): void {
    this.selectedBook.set(book);
    this.bookResults.set([]);
    this.bookSearch.setValue(book.title, { emitEvent: false });
  }

  clearBook(): void {
    this.selectedBook.set(null);
    this.bookSearch.setValue('');
  }

  submit(): void {
    const book = this.selectedBook();
    if (!book) {
      this.toast.warning('Selecione um livro para continuar.');
      return;
    }
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.fieldErrors.set([]);

    const data = this.form.getRawValue();
    this.rentalService
      .create({
        bookId: book.id,
        userId: data.userId.trim(),
        periodDays: data.periodDays,
      })
      .subscribe({
        next: (rental) => {
          this.saving.set(false);
          this.toast.success('Locação criada', `Devolução prevista para ${this.formatPtBr(rental.dueDate)}.`);
          this.router.navigate(['/admin/locacoes', rental.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          const body = err.error as ApiError | undefined;
          this.errorMessage.set(body?.erro ?? 'Não foi possível criar a locação.');
          this.fieldErrors.set(body?.detalhes ?? []);
        },
      });
  }

  fieldInvalid(name: 'userId' | 'periodDays'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private formatPtBr(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}
