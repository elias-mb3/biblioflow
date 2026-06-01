import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-usuario-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './usuario-shell.html',
  styleUrl: './usuario-shell.css',
})
export class UsuarioShellComponent {
  private readonly auth = inject(AuthService);

  readonly displayName = computed(() => {
    return this.auth.user()?.fullName ?? 'Leitor';
  });

  logout(): void {
    this.auth.logout();
  }
}
