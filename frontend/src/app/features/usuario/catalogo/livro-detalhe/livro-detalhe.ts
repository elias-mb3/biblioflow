import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Book } from '../../../../core/models/book.model';
import { BookService } from '../../../../core/services/book.service';
import { ToastService } from '../../../../core/services/toast.service';
import { SpinnerComponent } from '../../../../shared/components/spinner/spinner';

@Component({
  selector: 'app-livro-detalhe',
  imports: [CommonModule, RouterLink, DatePipe, SpinnerComponent],
  templateUrl: './livro-detalhe.html',
  styleUrl: './livro-detalhe.css',
})
export class LivroDetalheComponent {
  private readonly bookService = inject(BookService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly book = signal<Book | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/usuario/catalogo']);
      return;
    }
    this.bookService.getById(id).subscribe({
      next: (book) => {
        this.book.set(book);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Livro não encontrado');
        this.router.navigate(['/usuario/catalogo']);
      },
    });
  }
}
