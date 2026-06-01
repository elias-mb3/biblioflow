import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div
        *ngFor="let t of toasts.toasts()"
        class="toast"
        [class.toast--success]="t.kind === 'success'"
        [class.toast--danger]="t.kind === 'danger'"
        [class.toast--warning]="t.kind === 'warning'"
        role="status"
      >
        <div class="toast__content">
          <div class="toast__title">{{ t.title }}</div>
          <div class="toast__message" *ngIf="t.message">{{ t.message }}</div>
        </div>
        <button class="toast__close" type="button" (click)="toasts.dismiss(t.id)" aria-label="Fechar">
          ×
        </button>
      </div>
    </div>
  `,
})
export class ToastComponent {
  readonly toasts = inject(ToastService);
}
