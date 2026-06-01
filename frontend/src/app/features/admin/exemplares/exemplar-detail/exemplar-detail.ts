import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApiError } from '../../../../core/models/api-error.model';
import { Book } from '../../../../core/models/book.model';
import { BookService } from '../../../../core/services/book.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal';
import { SpinnerComponent } from '../../../../shared/components/spinner/spinner';

@Component({
  selector: 'app-exemplar-detail',
  imports: [CommonModule, RouterLink, DatePipe, SpinnerComponent, ModalComponent],
  templateUrl: './exemplar-detail.html',
  styleUrl: './exemplar-detail.css',
})
export class ExemplarDetailComponent {
  private readonly bookService = inject(BookService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly deleting = signal(false);
  readonly book = signal<Book | null>(null);
  readonly confirmingDelete = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/exemplares']);
      return;
    }
    this.bookService.getById(id).subscribe({
      next: (book) => {
        this.book.set(book);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Exemplar não encontrado');
        this.router.navigate(['/admin/exemplares']);
      },
    });
  }

  confirmDelete(): void {
    const book = this.book();
    if (!book) return;
    this.deleting.set(true);
    this.bookService.delete(book.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Exemplar excluído');
        this.router.navigate(['/admin/exemplares']);
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.confirmingDelete.set(false);
        const body = err.error as ApiError | undefined;
        this.toast.error(
          'Não foi possível excluir',
          body?.erro ?? 'Verifique se há locações ativas para este exemplar.',
        );
      },
    });
  }
}
