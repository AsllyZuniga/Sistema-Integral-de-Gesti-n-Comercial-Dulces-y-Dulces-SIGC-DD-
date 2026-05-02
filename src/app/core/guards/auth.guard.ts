import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Observable<boolean | UrlTree> | boolean | UrlTree {
    const redireccion = this.router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url || '/dashboard' },
    });

    if (!this.auth.isLoggedIn()) {
      this.auth.forzarReingreso(false);
      return redireccion;
    }

    this.auth.iniciarTimerInactividad();

    return this.auth.validarSesionBackendUnaVez().pipe(
      map((sesionValida) => {
        if (sesionValida) {
          return true;
        }

        this.auth.forzarReingreso(false);
        return redireccion;
      }),
      catchError(() => of(true)),
    );
  }
}
