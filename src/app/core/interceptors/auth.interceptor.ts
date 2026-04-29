import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../services/session.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiOrigin = new URL(environment.apiUrl).origin;
  const requestUrl = new URL(req.url, window.location.origin);
  const esApiConfiable = requestUrl.origin === apiOrigin;
  const isAuthLoginRequest = requestUrl.pathname.includes('/api/auth/login');
  const isCuotasVendedorUploadRequest = requestUrl.pathname.includes('/import/cuotas/upload');

  if (isAuthLoginRequest) {
    return next(req);
  }

  const session = inject(SessionService);
  const jwt = session.getToken();

  if (jwt && esApiConfiable && !isCuotasVendedorUploadRequest) {
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
