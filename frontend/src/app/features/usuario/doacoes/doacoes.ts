import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

import { ApiError } from '../../../core/models/api-error.model';
import { Book } from '../../../core/models/book.model';
import { AuthService } from '../../../core/services/auth.service';
import { BookService } from '../../../core/services/book.service';
import { DonationService } from '../../../core/services/donation.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-doacoes',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './doacoes.html',
  styleUrl: './doacoes.css',
})
export class DoacoesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly donationService = inject(DonationService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly bookResults = signal<Book[]>([]);
  readonly selectedBook = signal<Book | null>(null);
  readonly searching = signal(false);

  readonly bookSearch = new FormControl('', { nonNullable: true });
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    author: ['', [Validators.required, Validators.minLength(2)]],
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
        error: () => this.searching.set(false),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectExistingBook(book: Book): void {
    this.selectedBook.set(book);
    this.bookResults.set([]);
    this.bookSearch.setValue(book.title, { emitEvent: false });
    this.form.patchValue({ title: book.title, author: book.author });
  }

  clearSelection(): void {
    this.selectedBook.set(null);
    this.bookSearch.setValue('');
    this.form.reset({ title: '', author: '' });
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);

    const userId = this.auth.payload()?.sub;
    if (!userId) {
      this.saving.set(false);
      this.toast.error('Sessão expirada', 'Faça login novamente para registrar a doação.');
      return;
    }

    const value = this.form.getRawValue();
    this.donationService
      .create({
        userId,
        title: value.title,
        author: value.author,
        bookId: this.selectedBook()?.id,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Doação registrada', 'Obrigado por contribuir com o acervo!');
          this.form.reset({ title: '', author: '' });
          this.clearSelection();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          const body = err.error as ApiError | undefined;
          this.errorMessage.set(body?.erro ?? 'Não foi possível registrar a doação.');
        },
      });
  }

  fieldInvalid(name: 'title' | 'author'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }
}
