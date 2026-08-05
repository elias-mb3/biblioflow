import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

import { ApiError } from '../../../../core/models/api-error.model';
import { Book } from '../../../../core/models/book.model';
import { RENTAL_PERIODS, RentalPeriod } from '../../../../core/models/rental.model';
import { User } from '../../../../core/models/user.model';
import { BookService } from '../../../../core/services/book.service';
import { RentalService } from '../../../../core/services/rental.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UserService } from '../../../../core/services/user.service';

@Component({
  selector: 'app-locacao-form',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './locacao-form.html',
  styleUrl: './locacao-form.css',
})
export class LocacaoFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly bookService = inject(BookService);
  private readonly userService = inject(UserService);
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

  readonly userSearch = new FormControl('', { nonNullable: true });
  readonly userResults = signal<User[]>([]);
  readonly searchingUser = signal(false);
  readonly selectedUser = signal<User | null>(null);

  readonly form = this.fb.nonNullable.group({
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
          return this.bookService.search({ q: term.trim(), field: 'title' });
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

    this.userSearch.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.selectedUser.set(null);
          if (!term.trim() || term.length < 2) {
            this.userResults.set([]);
            this.searchingUser.set(false);
            return [];
          }
          this.searchingUser.set(true);
          return this.userService.search(term.trim());
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => {
          this.userResults.set(res.items);
          this.searchingUser.set(false);
        },
        error: () => {
          this.searchingUser.set(false);
          this.toast.error('Falha na busca de usuários');
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

  selectUser(user: User): void {
    this.selectedUser.set(user);
    this.userResults.set([]);
    this.userSearch.setValue(user.fullName, { emitEvent: false });
  }

  clearUser(): void {
    this.selectedUser.set(null);
    this.userSearch.setValue('');
  }

  submit(): void {
    const book = this.selectedBook();
    if (!book) {
      this.toast.warning('Selecione um livro para continuar.');
      return;
    }
    const user = this.selectedUser();
    if (!user) {
      this.toast.warning('Selecione um usuário para continuar.');
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
        userId: user.id,
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

  fieldInvalid(name: 'periodDays'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }

  private formatPtBr(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR');
  }
}
