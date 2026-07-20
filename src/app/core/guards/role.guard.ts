import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

export type PermisoMenu = 'ventas' | 'cuotas' | 'usuarios';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
    private session: SessionService,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.auth.isLoggedIn()) {
      this.auth.forzarReingreso(false);
      return this.router.parseUrl('/login');
    }

    const rolesPermitidos: number[] = route.data['roles'] ?? [];
    const usuario = this.auth.getVendedor();
    const rolId = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);

    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(rolId)) {
      return this.router.parseUrl('/dashboard');
    }

    const permiso: PermisoMenu | undefined = route.data['permiso'];
    if (permiso && !this.tienePermiso(permiso)) {
      return this.router.parseUrl('/dashboard');
    }

    this.auth.iniciarTimerInactividad();
    return true;
  }

  private tienePermiso(permiso: PermisoMenu): boolean {
    switch (permiso) {
      case 'ventas':
        return this.session.tieneAccesoVentas();
      case 'cuotas':
        return this.session.tieneAccesoCuotas();
      case 'usuarios':
        return this.session.tieneAccesoGestionUsuarios();
      default:
        return true;
    }
  }
}
