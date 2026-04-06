import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isAuthLoginRequest = req.url.includes('/api/auth/login');

  if (isAuthLoginRequest) {
    return next(req);
  }

  const session = inject(SessionService);
  const jwt = session.getToken();

  if (jwt) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${jwt}`,
      },
    });
  }

  return next(req);
};
