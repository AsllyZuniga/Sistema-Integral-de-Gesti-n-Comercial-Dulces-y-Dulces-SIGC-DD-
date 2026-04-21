import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.auth.isLoggedIn()) {
      this.auth.forzarReingreso(false);
      return this.router.parseUrl('/login');
    }

    const rolesPermitidos: number[] = route.data['roles'] ?? [];
    if (rolesPermitidos.length === 0) return true;

    // ✅ Lee desde sessionStorage via AuthService
    const usuario = this.auth.getVendedor();
    const rolId   = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);

    if (rolesPermitidos.includes(rolId)) {
      this.auth.iniciarTimerInactividad();
      return true;
    }

    return this.router.parseUrl('/dashboard');
  }
}