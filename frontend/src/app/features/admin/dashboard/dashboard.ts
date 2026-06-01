import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { BookService } from '../../../core/services/book.service';
import { RentalService } from '../../../core/services/rental.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner';

interface DashboardStats {
  totalBooks: number;
  activeRentals: number;
  pendingRentals: number;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, SpinnerComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private readonly bookService = inject(BookService);
  private readonly rentalService = inject(RentalService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly stats = signal<DashboardStats | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      books: this.bookService.list(1),
      active: this.rentalService.list('ACTIVE'),
      pending: this.rentalService.getPending(),
    }).subscribe({
      next: ({ books, active, pending }) => {
        this.stats.set({
          totalBooks: books.total,
          activeRentals: active.total,
          pendingRentals: pending.total,
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Falha ao carregar dashboard', 'Verifique se a API está disponível.');
      },
    });
  }
}
