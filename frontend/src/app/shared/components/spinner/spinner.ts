import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  template: `
    <div class="spinner-wrap" [style.padding]="padding()">
      <span class="spinner" role="status" aria-label="Carregando"></span>
      @if (label()) {
        <span class="spinner-label">{{ label() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .spinner-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        padding: var(--space-6);
        color: var(--color-neutral-500);
        font-size: var(--text-sm);
      }
      .spinner {
        width: 22px;
        height: 22px;
        border: 2.5px solid var(--color-neutral-200);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SpinnerComponent {
  readonly label = input<string | null>(null);
  readonly padding = input<string>('var(--space-6)');
}
