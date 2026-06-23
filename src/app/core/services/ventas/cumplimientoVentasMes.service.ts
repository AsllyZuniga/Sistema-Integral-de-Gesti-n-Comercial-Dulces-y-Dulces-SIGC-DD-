import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, timeout } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

export interface VendedoresConItemsParams {
  vendedoresPage?: number;
  vendedoresLimit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CumplimientoService {
  private apiUrl = '/api';
  private vendedoresCache$?: Observable<any[]>;
  private proveedoresCache$?: Observable<any[]>;
  private cuotaCategoriasCache?: Observable<any>;
  private responseCache = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  private cacheKeyFromParams(params: HttpParams): string {
    if (!params || !params.keys().length) return 'empty';
    const keys = params.keys().sort();
    return keys.map((k) => `${k}=${params.get(k) ?? ''}`).join('&');
  }

  private getOrCreateCache(key: string, factory: () => Observable<any>): Observable<any> {
    const cached = this.responseCache.get(key);
    if (cached) return cached;
    const obs$ = factory().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      catchError(() => of(null)),
    );
    this.responseCache.set(key, obs$);
    return obs$;
  }

  /**
   * Invalida TODAS las respuestas cacheadas por clave de filtros.
   * Llamar cuando cambian las fechas / filtros que no estan contemplados en la cache.
   */
  invalidarCacheRespuestas(): void {
    this.responseCache.clear();
  }

  invalidarCachePorPrefijo(prefijo: string): void {
    for (const key of this.responseCache.keys()) {
      if (key.startsWith(prefijo)) this.responseCache.delete(key);
    }
  }

  private aplicarCategoriaParams(params: HttpParams, filtros?: DashboardFilters): HttpParams {
    const categorias = Array.isArray(filtros?.categorias)
      ? filtros?.categorias.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    console.debug('[CumplimientoService] aplicarCategoriaParams - categorías:', categorias);

    if (categorias.length > 1) {
      const categoriasCsv = categorias.join(',');
      console.debug('[CumplimientoService] aplicarCategoriaParams - enviando CSV:', categoriasCsv);
      params = params.set('categorias', categoriasCsv);
      return params;
    }

    if (categorias.length === 1) {
      console.debug('[CumplimientoService] aplicarCategoriaParams - enviando categoría única:', categorias[0]);
      params = params.set('categoria', categorias[0]);
      return params;
    }

    if (filtros?.categoria) {
      console.debug('[CumplimientoService] aplicarCategoriaParams - usando filtros.categoria:', filtros.categoria);
      params = params.set('categoria', filtros.categoria);
    }

    return params;
  }

  private aplicarProveedorParams(params: HttpParams, filtros?: DashboardFilters): HttpParams {
    const proveedores = Array.isArray(filtros?.proveedores)
      ? filtros.proveedores.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    console.debug('[CumplimientoService] aplicarProveedorParams - proveedores:', proveedores);

    if (proveedores.length > 1) {
      const proveedoresCsv = proveedores.join(',');
      console.debug('[CumplimientoService] aplicarProveedorParams - enviando CSV:', proveedoresCsv);
      params = params.delete('proveedor');
      params = params.set('proveedores', proveedoresCsv);
      return params;
    }

    if (proveedores.length === 1) {
      console.debug('[CumplimientoService] aplicarProveedorParams - enviando proveedor único:', proveedores[0]);
      params = params.delete('proveedores');
      params = params.set('proveedor', proveedores[0]);
      return params;
    }

    return params;
  }

  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();

    if (!filtros) return params;

    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros?.vendedor) params = params.set('vendedor', filtros.vendedor);
    if (filtros?.proveedor) params = params.set('proveedor', filtros.proveedor);
    params = this.aplicarProveedorParams(params, filtros);
    params = this.aplicarCategoriaParams(params, filtros);
    if (filtros?.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros?.ciudadNombre) params = params.set('ciudadNombre', filtros.ciudadNombre);
    if (filtros?.linea) params = params.set('linea', filtros.linea);

    return params;
  }

  /**
   * Params para endpoints /me.
   * No envía vendedor porque /me ya reconoce el vendedor autenticado.
   */
  private buildParamsForMe(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();

    if (!filtros) return params;

    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros?.proveedor) params = params.set('proveedor', filtros.proveedor);
    params = this.aplicarProveedorParams(params, filtros);
    params = this.aplicarCategoriaParams(params, filtros);
    if (filtros?.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros?.ciudadNombre) params = params.set('ciudadNombre', filtros.ciudadNombre);
    if (filtros?.linea) params = params.set('linea', filtros.linea);

    return params;
  }

  /**
   * Params for supervisor-bound endpoints.
   * Excludes vendedor because the path already scopes by supervisor.
   */
  private buildParamsForSupervisor(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();

    if (!filtros) return params;

    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros?.proveedor) params = params.set('proveedor', filtros.proveedor);
    params = this.aplicarProveedorParams(params, filtros);
    params = this.aplicarCategoriaParams(params, filtros);
    if (filtros?.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros?.ciudadNombre) params = params.set('ciudadNombre', filtros.ciudadNombre);
    if (filtros?.linea) params = params.set('linea', filtros.linea);

    return params;
  }

  /**
   * Params para /vendedor/con-items-comprados.
   * v1.4.1: el endpoint unificado solo pagina vendedores; clientes e items
   * se devuelven completos y no aceptan query params.
   */
  private buildVendedoresConItemsParams(
    filtros?: DashboardFilters,
    opciones: VendedoresConItemsParams = {},
  ): HttpParams {
    let params = this.buildParams(filtros);

    if (opciones.vendedoresPage !== undefined) {
      params = params.set('vendedoresPage', String(opciones.vendedoresPage));
    }

    if (opciones.vendedoresLimit !== undefined) {
      params = params.set('vendedoresLimit', String(opciones.vendedoresLimit));
    }

    return params;
  }

  /** Admin: GET /mes/cumplimiento/front → { periodo, detalle: [...vendedores, TOTALES] }
   *  Cacheado por clave de filtros con shareReplay(1): varios componentes
   *  pueden consumir la misma respuesta para un mismo rango de fechas
   *  sin disparar multiples HTTP.
   */
  getCumplimientoMesAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    const cacheKey = this.cacheKeyFromParams(params);

    return this.getOrCreateCache(
      `front-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/mes/cumplimiento/front`, { params })
          .pipe(catchError(() => of({ detalle: [] }))),
    );
  }

  /** Admin: GET /dia/cumplimiento/front → { periodo, detalle: [...], totales: {...} } */
  getCumplimientoDiaAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    const cacheKey = this.cacheKeyFromParams(params);

    return this.getOrCreateCache(
      `dia-front-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/dia/cumplimiento/front`, { params })
          .pipe(catchError(() => of({ detalle: [], totales: null, periodo: null }))),
    );
  }

  /** Vendedor: GET /mes/cumplimiento/front/me → { periodo, detalle: [vendedor, TOTALES] } */
  getCumplimientoMesVendedor(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForMe(filtros);
    const cacheKey = this.cacheKeyFromParams(params);

    return this.getOrCreateCache(
      `me-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/mes/cumplimiento/front/me`, { params })
          .pipe(catchError(() => of({ detalle: [] }))),
    );
  }

  /**
   * Vendedor: GET /dia/cumplimiento/front/me → { periodo, detalle: [vendedor], totales: {...} }
   * Se usa solo para rol vendedor cuando la cuota activa es diaria.
   */
  getCumplimientoDiaVendedor(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForMe(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/dia/cumplimiento/front/me`, { params })
      .pipe(catchError(() => of({ detalle: [], totales: null, periodo: null })));
  }

  /**
   * Supervisor: GET /dia/cumplimiento/supervisor/:idSupervisor
   * Devuelve el resumen diario del supervisor y, si el backend lo incluye, su lista de vendedores.
   */
  getCumplimientoDiaSupervisor(idSupervisor: string | number, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForSupervisor(filtros);
    const id = String(idSupervisor ?? '').trim();

    if (!id) {
      return of({ detalle: [], totales: null, periodo: null });
    }

    return this.http
      .get<any>(`${this.apiUrl}/dia/cumplimiento/supervisor/${encodeURIComponent(id)}`, {
        params,
      })
      .pipe(catchError(() => of({ detalle: [], totales: null, periodo: null })));
  }

  getCumplimientoMes(filtros?: DashboardFilters): Observable<any[]> {
    const params = this.buildParams(filtros);

    return this.http.get<any[]>(`${this.apiUrl}/mes/cumplimiento`, { params }).pipe(
      map((res) => (Array.isArray(res) ? res : [])),
      catchError(() => of([])),
    );
  }

  getCumplimientoPorCodigo(codigo: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForMe(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/front/me`, { params })
      .pipe(catchError(() => of(null)));
  }

  /**
   * GET /mes/cumplimiento/vendedor/:codigo/lineas → detallePorLinea del vendor
   * Cacheado por (codigoVendedor + filtros) con shareReplay(1) para evitar
   * llamadas repetidas cuando varios componentes la solicitan con la misma clave.
   */
  getLineasPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const codigo = String(codigoVendedor ?? '').trim();
    if (!codigo) return of({ detallePorLinea: [] });

    const params = this.buildParams(filtros);
    const cacheKey = this.cacheKeyFromParams(params);
    return this.getOrCreateCache(
      `lineas-${codigo}-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigo}/lineas`, { params })
          .pipe(
            map((res) => {
              if (res?.detallePorLinea) {
                res.detallePorLinea = Array.isArray(res.detallePorLinea)
                  ? res.detallePorLinea
                  : [];
              }
              return res;
            }),
            catchError(() => of({ detallePorLinea: [] })),
          ),
    );
  }

  getDetallePorLinea(
    codigoVendedor: string,
    codigoLinea: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http
      .get<any>(
        `${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoLinea}`,
        { params },
      )
      .pipe(
        map((res) => {
          if (res?.detallePorLinea) {
            res.detallePorLinea = Array.isArray(res.detallePorLinea)
              ? res.detallePorLinea
              : [];
          }

          return res;
        }),
        catchError(() => of({ detallePorLinea: [] })),
      );
  }

  getDetallePorLineaProveedor(
    codigoVendedor: string,
    codigoProveedor: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    let params = this.buildParams(filtros);

    if (params.has('proveedor')) {
      params = params.delete('proveedor');
    }

    return this.http
      .get<any>(
        `${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoProveedor}`,
        { params },
      )
      .pipe(catchError(() => of(null)));
  }

  /**
   * GET /mes/cumplimiento/vendedor/:codigo/ciudades → detallePorCiudad del vendor
   * Cacheado por (codigoVendedor + filtros) con shareReplay(1).
   */
  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const codigo = String(codigoVendedor ?? '').trim();
    if (!codigo) return of({ detallePorCiudad: [] });

    const params = this.buildParams(filtros);
    const cacheKey = this.cacheKeyFromParams(params);
    return this.getOrCreateCache(
      `ciudades-${codigo}-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigo}/ciudades`, { params })
          .pipe(
            map((res) => {
              if (res?.detallePorCiudad) {
                res.detallePorCiudad = Array.isArray(res.detallePorCiudad)
                  ? res.detallePorCiudad
                  : [];
              }
              return res;
            }),
            catchError(() => of({ detallePorCiudad: [] })),
          ),
    );
  }

  getCiudadesGlobal(filtros?: DashboardFilters): Observable<any> {
    let params = this.buildParams(filtros);

    if (params.has('vendedor')) {
      params = params.delete('vendedor');
    }

    return this.http.get<any>(`${this.apiUrl}/mes/cumplimiento/ciudades-global`, { params }).pipe(
      map((res) => ({
        ...(res ?? {}),
        periodo: res?.periodo ?? {},
        resumen: res?.resumen ?? {},
        detallePorCiudad: Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [],
      })),
      catchError(() => of({ periodo: {}, resumen: {}, detallePorCiudad: [] })),
    );
  }

  getDetallePorCiudad(
    codigoVendedor: string,
    codigoCiudad: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    let params = this.buildParams(filtros);

    if (params.has('ciudad')) {
      params = params.delete('ciudad');
    }

    return this.http
      .get<any>(
        `${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/ciudad/${codigoCiudad}`,
        { params },
      )
      .pipe(
        map((res) => {
          if (res?.detallePorCiudad) {
            res.detallePorCiudad = Array.isArray(res.detallePorCiudad)
              ? res.detallePorCiudad
              : [];
          }

          return res;
        }),
        catchError(() => of({ detallePorCiudad: [] })),
      );
  }

  getProductosPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/productos`, {
        params,
      })
      .pipe(
        map((res) => {
          if (res?.detallePorProducto) {
            res.data = Array.isArray(res.detallePorProducto) ? res.detallePorProducto : [];
          } else if (res?.data) {
            res.data = Array.isArray(res.data) ? res.data : [];
          } else {
            res = { ...res, data: [] };
          }

          return res;
        }),
        catchError(() => of({ data: [] })),
      );
  }

  /**
   * GET /cuota-categoria/vendedor/:codigo → detalle de categorias del vendor
   * Cacheado por (codigoVendedor + filtros) con shareReplay(1).
   */
  getCuotaCategoriaPorVendedor(
    codigoVendedor: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    let params = this.buildParams(filtros);

    if (params.has('vendedor')) {
      params = params.delete('vendedor');
    }

    const codigo = String(codigoVendedor ?? '').trim();

    if (!codigo) {
      return of({ detalle: [] });
    }

    const cacheKey = this.cacheKeyFromParams(params);
    return this.getOrCreateCache(
      `cuota-cat-${codigo}-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/cuota-categoria/vendedor/${encodeURIComponent(codigo)}`, {
            params,
          })
          .pipe(
            map((res) => ({
              ...(res ?? {}),
              detalle: Array.isArray(res?.detalle) ? res.detalle : [],
            })),
            catchError(() => of({ detalle: [] })),
          ),
    );
  }

  getProductosPorCliente(idVendedor: string | number, filtros?: DashboardFilters): Observable<any> {
    let params = this.buildParams(filtros);

    if (params.has('vendedor')) {
      params = params.delete('vendedor');
    }

    const id = String(idVendedor ?? '').trim();

    if (!id) {
      return of({ data: [] });
    }

    const endpoint = `${this.apiUrl}/cliente/productos-por-cliente/vendedor/${encodeURIComponent(
      id,
    )}`;

    return this.http.get<any>(endpoint, { params }).pipe(
      map((res) => {
        const data = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.detalle)
              ? res.detalle
              : [];

        return { ...(res ?? {}), data };
      }),
      catchError(() => of({ data: [] })),
    );
  }

  getProductosPorClienteGeneral(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http.get<any>(`${this.apiUrl}/cliente/productos-por-cliente`, { params }).pipe(
      map((res) => {
        const data = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.detalle)
              ? res.detalle
              : [];

        return { ...(res ?? {}), data };
      }),
      catchError(() => of({ data: [] })),
    );
  }

  /**
   * Admin: una sola petición para Detalle por Cliente.
   * Backend: GET /vendedor/con-items-comprados
   *
   * Respuestas soportadas:
   * 1. { data: { vendedores: [...], paginacionVendedores: {...} } }
   * 2. { vendedores: [...], paginacionVendedores: {...} }
   * 3. [...]
   */
  getVendedoresConItemsComprados(
    filtros?: DashboardFilters,
    opciones: VendedoresConItemsParams = {},
  ): Observable<any> {
    const params = this.buildVendedoresConItemsParams(filtros, opciones);

    console.debug('🔍 [CumplimientoService] Solicitando /vendedor/con-items-comprados', {
      apiUrl: this.apiUrl,
      params: params.keys(),
    });

    return this.http.get<any>(`${this.apiUrl}/vendedor/con-items-comprados`, { params }).pipe(
      timeout(30000), // Timeout de 30 segundos
      map((res) => {
        const vendedores = Array.isArray(res?.data?.vendedores)
          ? res.data.vendedores
          : Array.isArray(res?.vendedores)
            ? res.vendedores
            : Array.isArray(res)
              ? res
              : [];

        const paginacionVendedores =
          res?.data?.paginacionVendedores ??
          res?.paginacionVendedores ??
          res?.data?.pagination ??
          res?.pagination ??
          null;

        console.debug('✅ [CumplimientoService] /vendedor/con-items-comprados respondió', {
          vendedoresCount: vendedores.length,
        });

        return {
          ...(res ?? {}),
          data: {
            ...(res?.data ?? {}),
            vendedores,
            paginacionVendedores,
          },
        };
      }),
      catchError((err) => {
        if (err.name === 'TimeoutError') {
          console.error('⏱️ [CumplimientoService] TIMEOUT en /vendedor/con-items-comprados (30s):', {
            apiUrl: this.apiUrl,
            params: params.keys(),
          });
        } else {
          console.error('❌ [CumplimientoService] Error en /vendedor/con-items-comprados:', {
            status: err.status,
            message: err.message,
            error: err.error,
          });
        }

        return of({
          data: {
            vendedores: [],
            paginacionVendedores: null,
            _error: err.name === 'TimeoutError' ? 'timeout' : 'error',
            _errorMessage:
              err.name === 'TimeoutError'
                ? 'La solicitud tardó demasiado tiempo. Intenta con filtros más específicos.'
                : err.message || 'Error al cargar los datos',
          },
        });
      }),
    );
  }

  /**
   * @deprecated Desde v1.4.1 el endpoint es único para todos los roles.
   * Mantenido como alias temporal para no romper consumidores existentes;
   * delegar en `getVendedoresConItemsComprados` (misma URL `/vendedor/con-items-comprados`).
   */
  getVendedoresConItemsCompradosSupervisor(
    filtros?: DashboardFilters,
    opciones: VendedoresConItemsParams = {},
  ): Observable<any> {
    return this.getVendedoresConItemsComprados(filtros, opciones);
  }

  getVendedores(): Observable<any[]> {
    if (!this.vendedoresCache$) {
      this.vendedoresCache$ = this.http.get<any[]>(`${this.apiUrl}/vendedor`).pipe(
        map((res) => (Array.isArray(res) ? res.filter((v: any) => v.status !== false) : [])),
        catchError(() => of([])),
        shareReplay(1),
      );
    }

    return this.vendedoresCache$;
  }

  getProveedores(): Observable<any[]> {
    if (!this.proveedoresCache$) {
      this.proveedoresCache$ = this.http.get<any[]>(`${this.apiUrl}/proveedor`).pipe(
        map((res) => (Array.isArray(res) ? res : [])),
        catchError(() => of([])),
        shareReplay(1),
      );
    }

    return this.proveedoresCache$;
  }

  /** Admin: GET /mes/cumplimiento/lineas → detallePorLinea proveedores */
  getLineasAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http.get<any>(`${this.apiUrl}/mes/cumplimiento/lineas`, { params }).pipe(
      map((res) => {
        if (res?.detallePorLinea) {
          res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
        }

        return res;
      }),
      catchError(() => of({ detallePorLinea: [] })),
    );
  }

  /** GET /cuota-categoria/vendedores → categorías de múltiples vendedores con filtros de fecha.
   *  Cacheado con shareReplay(1): no cambia durante la sesion salvo recarga manual.
   *  Se invalida con invalidarCacheMapaCategorias() al cambiar de mes.
   */
  getCuotaCategoriasPorVendedores(filtros?: DashboardFilters): Observable<any> {
    if (!this.cuotaCategoriasCache) {
      this.cuotaCategoriasCache = this.http
        .get<any>(`${this.apiUrl}/cuota-categoria/vendedores`)
        .pipe(
          map((res) => ({
            ...(res ?? {}),
            periodo: res?.periodo ?? {},
            detalle: Array.isArray(res?.detalle) ? res.detalle : [],
          })),
          catchError(() => of({ periodo: {}, detalle: [] })),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.cuotaCategoriasCache;
  }

  invalidarCacheMapaCategorias(): void {
    this.cuotaCategoriasCache = undefined;
  }

  getCuotaCategoriaGeneral(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http.get<any>(`${this.apiUrl}/cuota-categoria/general`, { params }).pipe(
      map((res) => ({
        ...(res ?? {}),
        periodo: res?.periodo ?? {},
        detalle: Array.isArray(res?.detalle) ? res.detalle : [],
      })),
      catchError(() => of({ periodo: {}, detalle: [] })),
    );
  }
}