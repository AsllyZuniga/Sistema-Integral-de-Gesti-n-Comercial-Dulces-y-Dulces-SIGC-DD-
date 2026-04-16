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
    // Regla de negocio: nunca permitir salto Home -> Dashboard sin pasar por Login.
    // Esto debe aplicar también cuando el usuario escribe /dashboard manualmente estando en Home.
    const targetEsDashboard = state.url.startsWith('/dashboard');
    const currentPath = String(this.router.url ?? '').split('?')[0].trim();
    const vieneDesdeHome = currentPath === '/';

    if (targetEsDashboard && vieneDesdeHome) {
      return this.router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url || '/dashboard' },
      });
    }

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
