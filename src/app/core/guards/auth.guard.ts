import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (this.auth.isLoggedIn()) {
      this.auth.iniciarTimerInactividad();
      return true;
    }

    // Limpia estado local, pero redirige explícitamente con UrlTree para evitar
    // quedarse en la ruta actual cuando la navegación a /dashboard es cancelada.
    this.auth.forzarReingreso(false);
    return this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url || '/dashboard' },
    });
  }
}
