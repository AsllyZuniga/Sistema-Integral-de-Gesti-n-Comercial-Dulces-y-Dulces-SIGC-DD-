import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Con rutas relativas, todas las URLs que comiencen con /api/ son parte de la API local
  const isApiRequest = req.url.startsWith('/api/');
  const isAuthLoginRequest = req.url.includes('/api/auth/login');
  const isCuotasVendedorUploadRequest = req.url.includes('/import/cuotas/upload');

  if (isAuthLoginRequest) {
    return next(req);
  }

  const session = inject(SessionService);
  const jwt = session.getToken();

  if (jwt && isApiRequest && !isCuotasVendedorUploadRequest) {
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
