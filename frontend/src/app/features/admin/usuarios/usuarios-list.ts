import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs';

import { PaginatedUsers, UserService } from '../../../core/services/user.service';
import { User } from '../../../core/models/user.model';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner';

@Component({
  selector: 'app-usuarios-list',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    SpinnerComponent,
    EmptyStateComponent,
    PaginationComponent,
  ],
  templateUrl: './usuarios-list.html',
  styleUrl: './usuarios-list.css',
})
export class UsuariosListComponent {
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly users = signal<User[]>([]);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly totalItems = signal(0);
  readonly searchActive = signal(false);

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
            return this.userService.list(1);
          }
          this.searchActive.set(true);
          return this.userService.search(term.trim());
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res) => this.applyResult(res),
        error: () => {
          this.loading.set(false);
          this.toast.error('Falha ao buscar', 'Não foi possível consultar os usuários.');
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
    this.userService.list(page).subscribe({
      next: (res) => this.applyResult(res),
      error: () => {
        this.loading.set(false);
        this.toast.error('Falha ao carregar usuários');
      },
    });
  }

  private applyResult(res: PaginatedUsers): void {
    this.users.set(res.items);
    this.totalItems.set(res.total);
    this.totalPages.set(res.pages);
    this.currentPage.set(res.page);
    this.loading.set(false);
  }
}
