import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

import { ApiError } from '../../../core/models/api-error.model';
import { Book, PaginatedBooks, BookSearchParams } from '../../../core/models/book.model';
import { BookService } from '../../../core/services/book.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner';

type SearchField = 'title' | 'author' | 'registrationCode';

@Component({
  selector: 'app-exemplares-list',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    SpinnerComponent,
    EmptyStateComponent,
    ModalComponent,
    PaginationComponent,
  ],
  templateUrl: './exemplares-list.html',
  styleUrl: './exemplares-list.css',
})
export class ExemplaresListComponent {
  private readonly bookService = inject(BookService);
  private readonly toast = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly deleting = signal(false);
  readonly books = signal<Book[]>([]);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly totalItems = signal(0);
  readonly searchActive = signal(false);

  readonly searchField = signal<SearchField>('title');
  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly bookToDelete = signal<Book | null>(null);

  constructor() {
    this.loadPage(1);
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.loading.set(true);
          if (!term.trim()) {
            this.searchActive.set(false);
            return this.bookService.list(1);
          }
          this.searchActive.set(true);
          const query: BookSearchParams = { [this.searchField()]: term.trim() };
          return this.bookService.search(query);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => this.applyResult(res),
        error: () => {
          this.loading.set(false);
          this.toast.error('Falha ao buscar', 'Não foi possível consultar o acervo.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPage(page: number): void {
    this.loading.set(true);
    this.searchActive.set(false);
    this.bookService.list(page).subscribe({
      next: (res) => this.applyResult(res),
      error: () => {
        this.loading.set(false);
        this.toast.error('Falha ao carregar exemplares');
      },
    });
  }

  private applyResult(res: PaginatedBooks): void {
    this.books.set(res.items);
    this.totalItems.set(res.total);
    this.totalPages.set(res.pages);
    this.currentPage.set(res.page);
    this.loading.set(false);
  }

  onFieldChange(field: SearchField): void {
    this.searchField.set(field);
    if (this.searchControl.value.trim()) {
      this.searchControl.setValue(this.searchControl.value, { emitEvent: true });
    }
  }

  askDelete(book: Book): void {
    this.bookToDelete.set(book);
  }

  cancelDelete(): void {
    if (!this.deleting()) this.bookToDelete.set(null);
  }

  confirmDelete(): void {
    const book = this.bookToDelete();
    if (!book) return;
    this.deleting.set(true);
    this.bookService.delete(book.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.bookToDelete.set(null);
        this.toast.success('Exemplar excluído', `${book.title} foi removido do acervo.`);
        this.loadPage(this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        const body = err.error as ApiError | undefined;
        this.toast.error(
          'Não foi possível excluir',
          body?.erro ?? 'Verifique se há locações ativas para este exemplar.',
        );
        this.bookToDelete.set(null);
      },
    });
  }
}
