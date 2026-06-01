import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../../core/models/api-error.model';
import { Rental } from '../../../../core/models/rental.model';
import { RentalService } from '../../../../core/services/rental.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { SpinnerComponent } from '../../../../shared/components/spinner/spinner';

@Component({
  selector: 'app-locacao-detail',
  imports: [CommonModule, RouterLink, DatePipe, SpinnerComponent, ModalComponent],
  templateUrl: './locacao-detail.html',
  styleUrl: './locacao-detail.css',
})
export class LocacaoDetailComponent {
  private readonly rentalService = inject(RentalService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly finalizing = signal(false);
  readonly rental = signal<Rental | null>(null);
  readonly confirmingFinalize = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/locacoes']);
      return;
    }
    this.rentalService.getById(id).subscribe({
      next: (rental) => {
        this.rental.set(rental);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Locação não encontrada');
        this.router.navigate(['/admin/locacoes']);
      },
    });
  }

  confirmFinalize(): void {
    const rental = this.rental();
    if (!rental) return;
    this.finalizing.set(true);
    this.rentalService.finalize(rental.id).subscribe({
      next: (updated) => {
        this.finalizing.set(false);
        this.confirmingFinalize.set(false);
        this.rental.set(updated);
        this.toast.success(
          'Devolução finalizada',
          updated.late ? 'Devolução com atraso registrada.' : 'Devolução registrada com sucesso.',
        );
      },
      error: (err: HttpErrorResponse) => {
        this.finalizing.set(false);
        this.confirmingFinalize.set(false);
        const body = err.error as ApiError | undefined;
        this.toast.error('Não foi possível finalizar', body?.erro);
      },
    });
  }
}
