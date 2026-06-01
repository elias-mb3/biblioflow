import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Rental } from '../../../../core/models/rental.model';
import { RentalService } from '../../../../core/services/rental.service';
import { ToastService } from '../../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state';
import { SpinnerComponent } from '../../../../shared/components/spinner/spinner';

interface PendingRow extends Rental {
  daysLate: number;
}

@Component({
  selector: 'app-locacoes-pendentes',
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    SpinnerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './locacoes-pendentes.html',
  styleUrl: './locacoes-pendentes.css',
})
export class LocacoesPendentesComponent {
  private readonly rentalService = inject(RentalService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly rentals = signal<Rental[]>([]);

  readonly rows = computed<PendingRow[]>(() => {
    const now = Date.now();
    return this.rentals().map((r) => ({
      ...r,
      daysLate: Math.max(0, Math.floor((now - new Date(r.dueDate).getTime()) / 86_400_000)),
    }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.rentalService.getPending().subscribe({
      next: (res) => {
        this.rentals.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Falha ao carregar pendências');
      },
    });
  }
}
