import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state">
      <div class="empty-state__icon">{{ icon() }}</div>
      <h3 class="empty-state__title">{{ title() }}</h3>
      @if (message()) {
        <p class="empty-state__message">{{ message() }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .empty-state {
        text-align: center;
        padding: var(--space-10) var(--space-6);
        color: var(--color-neutral-500);
      }
      .empty-state__icon {
        font-size: var(--text-3xl);
        margin-bottom: var(--space-3);
      }
      .empty-state__title {
        color: var(--color-neutral-700);
        margin-bottom: var(--space-2);
      }
      .empty-state__message {
        font-size: var(--text-sm);
        max-width: 420px;
        margin: 0 auto var(--space-4);
      }
    `,
  ],
  host: { '[attr.role]': '"status"' },
})
export class EmptyStateComponent {
  readonly icon = input<string>('∅');
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
}
