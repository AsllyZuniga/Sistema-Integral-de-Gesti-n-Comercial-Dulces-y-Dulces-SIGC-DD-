import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, throwError } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

@Injectable({
  providedIn: 'root',
})
export class CumplimientoSemanaService {
  private apiUrl = '/api';
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
    );
    this.responseCache.set(key, obs$);
    return obs$;
  }

  /**
   * Invalida respuestas cacheadas por prefijo de clave. Llamar cuando
   * cambian los filtros que NO estan contemplados en la cache (mes, rol,
   * supervisor, etc.) para forzar la siguiente llamada a re-peir al backend.
   */
  invalidarCachePorPrefijo(prefijo: string): void {
    for (const key of this.responseCache.keys()) {
      if (key.startsWith(prefijo)) this.responseCache.delete(key);
    }
  }

  invalidarCacheRespuestas(): void {
    this.responseCache.clear();
  }

  private aplicarCategoriaParams(params: HttpParams, filtros?: DashboardFilters): HttpParams {
    const categorias = Array.isArray(filtros?.categorias)
      ? filtros?.categorias.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    if (categorias.length > 1) {
      const categoriasCsv = categorias.join(',');
      params = params.set('categorias', categoriasCsv);
      return params;
    }

    if (categorias.length === 1) {
      params = params.set('categoria', categorias[0]);
      return params;
    }

    if (filtros?.categoria) params = params.set('categoria', filtros.categoria);

    return params;
  }

  private aplicarProveedorParams(params: HttpParams, filtros?: DashboardFilters): HttpParams {
    const proveedores = Array.isArray(filtros?.proveedores)
      ? filtros.proveedores.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    if (proveedores.length > 1) {
      params = params.delete('proveedor');
      params = params.set('proveedores', proveedores.join(','));
      return params;
    }

    if (proveedores.length === 1) {
      params = params.delete('proveedores');
      params = params.set('proveedor', proveedores[0]);
      return params;
    }

    return params;
  }

  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;
    if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros.vendedor) params = params.set('vendedor', filtros.vendedor);
    if (filtros.proveedor) params = params.set('proveedor', filtros.proveedor);
    params = this.aplicarProveedorParams(params, filtros);
    params = this.aplicarCategoriaParams(params, filtros);
    if (filtros.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros.linea) params = params.set('linea', filtros.linea);
    return params;
  }

  /**
   * Normaliza el codigo de vendedor para garantizar una unica clave de cache
   * y una unica URL por vendedor. Los codigos numericos se rellenan a 4
   * digitos con ceros a la izquierda (ej. "125" -> "0125") para que
   * "125" y "0125" apunten al mismo recurso.
   */
  protected normalizarCodigoVendedor(valor: unknown): string {
    const codigo = String(valor ?? '').trim();
    if (!codigo) return '';
    return /^\d+$/.test(codigo) && codigo.length < 4 ? codigo.padStart(4, '0') : codigo;
  }

  /** Params for /me endpoints - excludes vendedor param since /me already knows the authenticated vendor */
  private buildParamsForMe(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;
    if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    // DO NOT include vendedor - /me endpoint already knows who the authenticated user is
    if (filtros.proveedor) params = params.set('proveedor', filtros.proveedor);
    params = this.aplicarProveedorParams(params, filtros);
    params = this.aplicarCategoriaParams(params, filtros);
    if (filtros.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros.linea) params = params.set('linea', filtros.linea);
    return params;
  }

  // ─── CUMPLIMIENTO GENERAL ────────────────────────────────────────────────────

  /**
   * Admin: GET /semana/cumplimiento/front
   * Devuelve { periodo, detalle: [...vendedores, TOTALES] }
   */
  getCumplimientoSemanaAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/front`, { params })
      .pipe(
        map((res) => ({
          ...(res ?? {}),
          periodo: res?.periodo ?? res?.data?.periodo ?? {},
          detalle: Array.isArray(res?.detalle)
            ? res.detalle
            : Array.isArray(res?.data?.detalle)
              ? res.data.detalle
              : [],
          totales: res?.totales ?? res?.data?.totales ?? null,
        })),
        catchError(() => of({ detalle: [], totales: null, periodo: {} })),
      );
  }

  /**
   * Vendedor: GET /semana/cumplimiento/front/me
   * Devuelve { periodo, detalle: [vendedor, TOTALES] }
   */
  getCumplimientoSemanaVendedor(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForMe(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/front/me`, { params })
      .pipe(
        map((res) => ({
          ...(res ?? {}),
          periodo: res?.periodo ?? res?.data?.periodo ?? {},
          detalle: Array.isArray(res?.detalle)
            ? res.detalle
            : Array.isArray(res?.data?.detalle)
              ? res.data.detalle
              : [],
          totales: res?.totales ?? res?.data?.totales ?? null,
        })),
        catchError(() => of({ detalle: [], totales: null, periodo: {} })),
      );
  }

  // ─── LÍNEAS ──────────────────────────────────────────────────────────────────

  /**
   * GET /semana/cumplimiento/lineas/:codigoVendedor
   * Devuelve { codigoVendedor, detallePorLinea: [...] }
   * Cacheado por (codigoVendedor + filtros) para evitar requests repetidos.
   */
  getLineasPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const codigo = this.normalizarCodigoVendedor(codigoVendedor);
    if (!codigo) return of({ detallePorLinea: [] });

    const params = this.buildParams(filtros);
    const cacheKey = this.cacheKeyFromParams(params);
    return this.getOrCreateCache(
      `lineas-${codigo}-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/semana/cumplimiento/lineas/${codigo}`, { params })
          .pipe(
            map((res) => {
              if (res?.detallePorLinea) {
                res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
              }
              return res;
            }),
            catchError(() => of({ detallePorLinea: [] })),
          ),
    );
  }

  /**
   * GET /semana/cumplimiento/lineas/:codigoVendedor/:codigoLinea
   * Devuelve { codigoVendedor, codigoLinea, detallePorLinea: [...] }
   */
  getDetallePorLinea(
    codigoVendedor: string,
    codigoLinea: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/lineas/${codigoVendedor}/${codigoLinea}`, {
        params,
      })
      .pipe(
        map((res) => {
          if (res?.detallePorLinea) {
            res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
          }
          return res;
        }),
        catchError(() => of({ detallePorLinea: [] })),
      );
  }

  // ─── CIUDADES ────────────────────────────────────────────────────────────────

  /**
   * GET /semana/cumplimiento/ciudades/:codigoVendedor
   * Devuelve { codigoVendedor, detallePorCiudad: [...] }
   * Cacheado por (codigoVendedor + filtros) para evitar requests repetidos.
   */
  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const codigo = this.normalizarCodigoVendedor(codigoVendedor);
    if (!codigo) return of({ detallePorCiudad: [] });

    const params = this.buildParams(filtros);
    const cacheKey = this.cacheKeyFromParams(params);
    return this.getOrCreateCache(
      `ciudades-${codigo}-${cacheKey}`,
      () =>
        this.http
          .get<any>(`${this.apiUrl}/semana/cumplimiento/ciudades/${codigo}`, { params })
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

  // ─── CATEGORÍAS ──────────────────────────────────────────────────────────────

  /**
   * GET /semana/cuota-categoria/vendedor/:codigoVendedor
   * Devuelve { detalle: [...categorías] }
   */
  getCuotaCategoriaPorVendedor(
    codigoVendedor: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    let params = this.buildParams(filtros);
    if (params.has('vendedor')) params = params.delete('vendedor');

    const codigo = this.normalizarCodigoVendedor(codigoVendedor);
    if (!codigo) return of({ detalle: [] });

    return this.http
      .get<any>(`${this.apiUrl}/semana/cuota-categoria/vendedor/${encodeURIComponent(codigo)}`, {
        params,
      })
      .pipe(
        map((res) => ({
          ...(res ?? {}),
          detalle: Array.isArray(res?.detalle) ? res.detalle : [],
        })),
        catchError(() => of({ detalle: [] })),
      );
  }

  // ─── PRODUCTOS / ITEMS ───────────────────────────────────────────────────────

  /**
   * GET /items-vendidos?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD&page=1&limit=100
   * Devuelve { data: [Proveedor, Cod_Item, Descripcion, Venta_Unid_Cajas, Cantidad, Subtotal],
   *            paginacion: { page, limit, total, paginado } }
   *
   * El endpoint es único para todos los roles (admin/supervisor/vendedor) y
   * determina el alcance según el token. El parámetro `codigoVendedor` se
   * mantiene por compatibilidad con consumidores existentes pero ya no se usa
   * en la URL.
   */
  getProductosPorVendedor(
    codigoVendedor: string,
    filtros?: DashboardFilters,
    opciones: { page?: number; limit?: number } = {},
  ): Observable<any> {
    const page = Number(opciones.page ?? 1) || 1;
    const limit = Math.min(100, Math.max(1, Number(opciones.limit ?? 100) || 100));
    const paramsBase = this.buildParams(filtros);
    const params = paramsBase.set('page', String(page)).set('limit', String(limit));

    return this.http
      .get<any>(`${this.apiUrl}/items-vendidos`, { params })
      .pipe(
        map((res) => {
          const body = res?.data ?? res ?? {};
          const rows = Array.isArray(body.rows) ? body.rows : [];

          const data = rows.map((r: any) => ({
            ...r,
            Proveedor: r?.proveedor ?? r?.Proveedor ?? '',
            Cod_Item:
              r?.codigo_item ?? r?.Cod_Item ?? r?.cod_item ?? r?.id_item ?? r?.idItem ?? '',
            Descripcion: r?.descripcion ?? r?.Descripcion ?? r?.producto ?? '',
            Venta_Unid_Cajas: Number(
              r?.unidades_cajas ?? r?.Venta_Unid_Cajas ?? r?.cantidad ?? 0,
            ),
            Cantidad: Number(r?.unidades_cajas ?? r?.Cantidad ?? r?.cantidad ?? 0),
            Subtotal: Number(r?.subtotal ?? r?.Subtotal ?? r?.subTotal ?? 0),
          }));

          const pagRaw = body.paginacion ?? null;
          const paginacion = pagRaw
            ? {
                page: Number(pagRaw.page ?? page) || page,
                limit: Number(pagRaw.limit ?? limit) || limit,
                total: Number(pagRaw.total ?? data.length) || 0,
                paginado: Boolean(pagRaw.paginado ?? true),
              }
            : null;

          return { data, paginacion };
        }),
        catchError(() => of({ data: [], paginacion: null })),
      );
  }

  // ─── LÍNEAS POR PROVEEDOR ────────────────────────────────────────────────────

  /**
   * GET /semana/cumplimiento/vendedor/:codigoVendedor/linea/:codigoProveedor
   * Devuelve { detallePorLinea: [...] }
   */
  getDetallePorLineaProveedor(
    codigoVendedor: string,
    codigoProveedor: string,
    filtros?: DashboardFilters,
  ): Observable<any> {
    const codigo = this.normalizarCodigoVendedor(codigoVendedor);
    if (!codigo) return of(null);

    let params = this.buildParams(filtros);
    if (params.has('proveedor')) params = params.delete('proveedor');
    return this.http
      .get<any>(
        `${this.apiUrl}/semana/cumplimiento/vendedor/${codigo}/linea/${codigoProveedor}`,
        { params },
      )
      .pipe(catchError(() => of(null)));
  }

  // ─── CUMPLIMIENTO POR CÓDIGO (VENDEDOR) ──────────────────────────────────────

  /**
   * GET /semana/cumplimiento/front/me
   * Devuelve totales y detalle por vendedor (semana)
   */
  getCumplimientoPorCodigo(codigo: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForMe(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/front/me`, { params })
      .pipe(
        map((res) => ({
          ...(res ?? {}),
          periodo: res?.periodo ?? res?.data?.periodo ?? {},
          detalle: Array.isArray(res?.detalle)
            ? res.detalle
            : Array.isArray(res?.data?.detalle)
              ? res.data.detalle
              : [],
          totales: res?.totales ?? res?.data?.totales ?? null,
        })),
        catchError(() => of({ detalle: [], totales: null, periodo: {} })),
      );
  }
}
