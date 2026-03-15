import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const rolesPermitidos: number[] = route.data['roles'] ?? [];

    if (rolesPermitidos.length === 0) return true;

    try {
      const raw = localStorage.getItem('vendedor') ?? localStorage.getItem('usuario') ?? '{}';
      const usuario = JSON.parse(raw);
      const rolId = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);

      if (rolesPermitidos.includes(rolId)) return true;
    } catch {
    }

    this.router.navigate(['/dashboard']);
    return false;
  }
}