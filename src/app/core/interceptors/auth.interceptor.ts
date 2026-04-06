import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isAuthLoginRequest = req.url.includes('/api/auth/login');

  if (isAuthLoginRequest) {
    return next(req);
  }

  // Leer el vendedor directamente de sessionStorage
  const vendedorRaw = sessionStorage.getItem('vendedor');
  console.log('🔍 [Interceptor] vendedor RAW en sessionStorage:', vendedorRaw);

  let jwt: string | null = null;
  if (vendedorRaw) {
    try {
      const vendedor = JSON.parse(vendedorRaw);
      jwt = vendedor?.jwt || vendedor?.token;
      
    } catch (e) {
      console.error('❌ [Interceptor] Error parseando vendedor:', e);
    }
  } else {
    console.warn('⚠️ [Interceptor] vendedor no encontrado en sessionStorage');
  }

  console.log('🔗 [Interceptor] URL de la request:', req.url);

  if (jwt) {
    
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${jwt}`,
      },
    });
  } else {
    
  }

  return next(req);
};
