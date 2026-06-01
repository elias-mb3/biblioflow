import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" *ngIf="open()" (click)="onBackdrop()">
      <div class="modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="modal__header">
          <h3 class="modal__title">{{ title() }}</h3>
        </header>
        <div class="modal__body">
          <ng-content></ng-content>
        </div>
        <footer class="modal__footer">
          <button class="btn btn--secondary" type="button" (click)="cancel.emit()">
            {{ cancelLabel() }}
          </button>
          <button
            class="btn"
            [class.btn--danger]="danger()"
            [class.btn--primary]="!danger()"
            type="button"
            (click)="confirm.emit()"
            [disabled]="loading()"
          >
            {{ loading() ? 'Aguarde…' : confirmLabel() }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly confirmLabel = input<string>('Confirmar');
  readonly cancelLabel = input<string>('Cancelar');
  readonly danger = input<boolean>(false);
  readonly loading = input<boolean>(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  onBackdrop(): void {
    if (!this.loading()) {
      this.cancel.emit();
    }
  }
}
