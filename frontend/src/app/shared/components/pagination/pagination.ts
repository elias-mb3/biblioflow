import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  imports: [CommonModule],
  template: `
    <nav class="pagination" *ngIf="totalPages() > 1" aria-label="Paginação">
      <button
        class="pagination__btn"
        type="button"
        [disabled]="currentPage() <= 1"
        (click)="go(currentPage() - 1)"
      >
        ‹ Anterior
      </button>
      <ul class="pagination__list">
        <li *ngFor="let p of pages()">
          <button
            type="button"
            class="pagination__page"
            [class.is-active]="p === currentPage()"
            (click)="go(p)"
          >
            {{ p }}
          </button>
        </li>
      </ul>
      <button
        class="pagination__btn"
        type="button"
        [disabled]="currentPage() >= totalPages()"
        (click)="go(currentPage() + 1)"
      >
        Próxima ›
      </button>
    </nav>
  `,
  styles: [
    `
      .pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        margin-top: var(--space-5);
      }
      .pagination__list {
        display: flex;
        gap: var(--space-1);
      }
      .pagination__btn,
      .pagination__page {
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm);
        background: var(--color-white);
        border: 1px solid var(--color-neutral-300);
        color: var(--color-neutral-700);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      .pagination__btn:hover:not(:disabled),
      .pagination__page:hover:not(.is-active) {
        background: var(--color-neutral-100);
      }
      .pagination__btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .pagination__page {
        min-width: 36px;
      }
      .pagination__page.is-active {
        background: var(--color-primary);
        color: var(--color-white);
        border-color: var(--color-primary);
      }
    `,
  ],
})
export class PaginationComponent {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();

  readonly pageChange = output<number>();

  readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const max = 7;
    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + max - 1);
    if (end - start + 1 < max) {
      start = Math.max(1, end - max + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  go(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }
}
