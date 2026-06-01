import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Rental, RentalStatus } from '../../../core/models/rental.model';
import { RentalService } from '../../../core/services/rental.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner';

type StatusFilter = 'ALL' | RentalStatus;

@Component({
  selector: 'app-locacoes-list',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DatePipe,
    SpinnerComponent,
    EmptyStateComponent,
  ],
  templateUrl: './locacoes-list.html',
  styleUrl: './locacoes-list.css',
})
export class LocacoesListComponent {
  private readonly rentalService = inject(RentalService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly rentals = signal<Rental[]>([]);
  readonly filter = signal<StatusFilter>('ALL');

  readonly activeCount = computed(
    () => this.rentals().filter((r) => r.status === 'ACTIVE').length,
  );
  readonly finalizedCount = computed(
    () => this.rentals().filter((r) => r.status === 'FINALIZED').length,
  );
  readonly lateCount = computed(() => this.rentals().filter((r) => r.late).length);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const f = this.filter();
    const status: RentalStatus | undefined = f === 'ALL' ? undefined : f;
    this.rentalService.list(status).subscribe({
      next: (res) => {
        this.rentals.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Falha ao carregar locações');
      },
    });
  }

  onFilterChange(value: StatusFilter): void {
    this.filter.set(value);
    this.load();
  }
}
