import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBase = String(environment.apiUrl ?? '').trim();

  // Soporta tanto rutas relativas (/api/...) como URLs absolutas apuntando al backend.
  const isApiRequest = req.url.startsWith('/api/') || (apiBase ? req.url.startsWith(apiBase) : false);
  const isAuthLoginRequest = req.url.includes('/api/auth/login');

  if (isAuthLoginRequest) {
    return next(req);
  }

  const session = inject(SessionService);
  const jwt = session.getToken();

  if (jwt && isApiRequest) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${jwt}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
  }

  return next(req).pipe(
    catchError((error) => {
      if (!isAuthLoginRequest && (error?.status === 401 || error?.status === 403)) {
        const router = inject(Router);
        session.clearUser(true);
        router.navigate(['/login'], { replaceUrl: true });
      }

      return throwError(() => error);
    }),
  );
};
