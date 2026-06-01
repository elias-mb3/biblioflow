import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'registrar/gestor',
    loadComponent: () =>
      import('./features/auth/register-gestor/register-gestor').then(
        (m) => m.RegisterGestorComponent,
      ),
  },
  {
    path: 'registrar/usuario',
    loadComponent: () =>
      import('./features/auth/register-usuario/register-usuario').then(
        (m) => m.RegisterUsuarioComponent,
      ),
  },

  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('MANAGER')],
    loadComponent: () =>
      import('./features/admin/admin-shell/admin-shell').then((m) => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'exemplares',
        loadComponent: () =>
          import('./features/admin/exemplares/exemplares-list').then(
            (m) => m.ExemplaresListComponent,
          ),
      },
      {
        path: 'exemplares/novo',
        loadComponent: () =>
          import('./features/admin/exemplares/exemplar-form/exemplar-form').then(
            (m) => m.ExemplarFormComponent,
          ),
      },
      {
        path: 'exemplares/:id',
        loadComponent: () =>
          import('./features/admin/exemplares/exemplar-detail/exemplar-detail').then(
            (m) => m.ExemplarDetailComponent,
          ),
      },
      {
        path: 'exemplares/:id/editar',
        loadComponent: () =>
          import('./features/admin/exemplares/exemplar-form/exemplar-form').then(
            (m) => m.ExemplarFormComponent,
          ),
      },
      {
        path: 'locacoes',
        loadComponent: () =>
          import('./features/admin/locacoes/locacoes-list').then((m) => m.LocacoesListComponent),
      },
      {
        path: 'locacoes/nova',
        loadComponent: () =>
          import('./features/admin/locacoes/locacao-form/locacao-form').then(
            (m) => m.LocacaoFormComponent,
          ),
      },
      {
        path: 'locacoes/pendentes',
        loadComponent: () =>
          import('./features/admin/locacoes/locacoes-pendentes/locacoes-pendentes').then(
            (m) => m.LocacoesPendentesComponent,
          ),
      },
      {
        path: 'locacoes/:id',
        loadComponent: () =>
          import('./features/admin/locacoes/locacao-detail/locacao-detail').then(
            (m) => m.LocacaoDetailComponent,
          ),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./features/admin/perfil/perfil').then((m) => m.PerfilComponent),
      },
    ],
  },

  {
    path: 'usuario',
    canActivate: [authGuard, roleGuard('USER')],
    loadComponent: () =>
      import('./features/usuario/usuario-shell/usuario-shell').then(
        (m) => m.UsuarioShellComponent,
      ),
    children: [
      { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
      {
        path: 'catalogo',
        loadComponent: () =>
          import('./features/usuario/catalogo/catalogo').then((m) => m.CatalogoComponent),
      },
      {
        path: 'catalogo/:id',
        loadComponent: () =>
          import('./features/usuario/catalogo/livro-detalhe/livro-detalhe').then(
            (m) => m.LivroDetalheComponent,
          ),
      },
      {
        path: 'doacoes',
        loadComponent: () =>
          import('./features/usuario/doacoes/doacoes').then((m) => m.DoacoesComponent),
      },
    ],
  },

  { path: '**', redirectTo: 'login' },
];
