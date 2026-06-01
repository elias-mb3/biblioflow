import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Role } from '../models/user.model';
import { AuthService } from '../services/auth.service';

export const roleGuard = (required: Role): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.role() === required) {
      return true;
    }

    if (auth.isLoggedIn()) {
      return router.createUrlTree([auth.role() === 'MANAGER' ? '/admin' : '/usuario']);
    }
    return router.createUrlTree(['/login']);
  };
};
