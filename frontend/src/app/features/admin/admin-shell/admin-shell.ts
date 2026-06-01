import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShellComponent {
  private readonly auth = inject(AuthService);

  readonly initials = computed(() => {
    const sub = this.auth.payload()?.sub ?? '';
    return sub.slice(0, 2).toUpperCase() || 'BF';
  });
  readonly identifier = computed(() => this.auth.payload()?.sub ?? 'Gestor');

  logout(): void {
    this.auth.logout();
  }
}
