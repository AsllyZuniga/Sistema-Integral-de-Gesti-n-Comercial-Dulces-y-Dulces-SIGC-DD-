import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Leer el vendedor directamente de sessionStorage
  const vendedorRaw = sessionStorage.getItem('vendedor');
  console.log('🔍 [Interceptor] vendedor RAW en sessionStorage:', vendedorRaw);

  let jwt: string | null = null;
  if (vendedorRaw) {
    try {
      const vendedor = JSON.parse(vendedorRaw);
      jwt = vendedor?.jwt || vendedor?.token;
      console.log('✅ [Interceptor] JWT extraído del vendedor:', jwt ? 'Presente' : 'No encontrado');
    } catch (e) {
      console.error('❌ [Interceptor] Error parseando vendedor:', e);
    }
  } else {
    console.warn('⚠️ [Interceptor] vendedor no encontrado en sessionStorage');
  }

  console.log('🔗 [Interceptor] URL de la request:', req.url);

  if (jwt) {
    console.log('✅ [Interceptor] Añadiendo Authorization header con JWT');
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${jwt}`,
      },
    });
  } else {
    console.warn('⚠️ [Interceptor] JWT no disponible - enviando request sin Authentication');
  }

  return next(req);
};
