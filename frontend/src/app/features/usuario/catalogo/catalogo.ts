import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

import { Book, PaginatedBooks } from '../../../core/models/book.model';
import { BookService } from '../../../core/services/book.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner';

@Component({
  selector: 'app-catalogo',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SpinnerComponent,
    EmptyStateComponent,
    PaginationComponent,
  ],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class CatalogoComponent {
  private readonly bookService = inject(BookService);
  private readonly toast = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly searchActive = signal(false);
  readonly books = signal<Book[]>([]);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly totalItems = signal(0);

  readonly searchControl = new FormControl('', { nonNullable: true });

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
          return this.bookService.search({ title: term.trim() });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => this.applyResult(res),
        error: () => {
          this.loading.set(false);
          this.toast.error('Falha ao buscar livros');
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
        this.toast.error('Falha ao carregar catálogo');
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
}
