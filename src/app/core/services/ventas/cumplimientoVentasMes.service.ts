import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, timeout } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

export interface VendedoresConItemsParams {
  vendedoresPage?: number;
  vendedoresLimit?: number;
  clientesPage?: number;
  clientesLimit?: number;
  itemsPage?: number;
  itemsLimit?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CumplimientoService {
  private apiUrl = '/api';
  private vendedoresCache$?: Observable<any[]>;
  private proveedoresCache$?: Observable<any[]>;

  constructor(private http: HttpClient) {}

  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();

    if (!filtros) return params;

    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros?.vendedor) params = params.set('vendedor', filtros.vendedor);
    if (filtros?.proveedor) params = params.set('proveedor', filtros.proveedor);
    if (filtros?.categoria) params = params.set('categoria', filtros.categoria);
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
    if (filtros?.categoria) params = params.set('categoria', filtros.categoria);
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
    if (filtros?.categoria) params = params.set('categoria', filtros.categoria);
    if (filtros?.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros?.ciudadNombre) params = params.set('ciudadNombre', filtros.ciudadNombre);
    if (filtros?.linea) params = params.set('linea', filtros.linea);

    return params;
  }

  /**
   * Params para /vendedor/con-items-comprados.
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

    if (opciones.clientesPage !== undefined) {
      params = params.set('clientesPage', String(opciones.clientesPage));
    }

    if (opciones.clientesLimit !== undefined) {
      params = params.set('clientesLimit', String(opciones.clientesLimit));
    }

    if (opciones.itemsPage !== undefined) {
      params = params.set('itemsPage', String(opciones.itemsPage));
    }

    if (opciones.itemsLimit !== undefined) {
      params = params.set('itemsLimit', String(opciones.itemsLimit));
    }

    return params;
  }

  /** Admin: GET /mes/cumplimiento/front → { periodo, detalle: [...vendedores, TOTALES] } */
  getCumplimientoMesAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/front`, { params })
      .pipe(catchError(() => of({ detalle: [] })));
  }

  /** Admin: GET /dia/cumplimiento/front → { periodo, detalle: [...], totales: {...} } */
  getCumplimientoDiaAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/dia/cumplimiento/front`, { params })
      .pipe(catchError(() => of({ detalle: [], totales: null, periodo: null })));
  }

  /** Vendedor: GET /mes/cumplimiento/front/me → { periodo, detalle: [vendedor, TOTALES] } */
  getCumplimientoMesVendedor(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParamsForMe(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/front/me`, { params })
      .pipe(catchError(() => of({ detalle: [] })));
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

  getLineasPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/lineas`, { params })
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

  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/ciudades`, {
        params,
      })
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

    return this.http
      .get<any>(`${this.apiUrl}/cuota-categoria/vendedor/${encodeURIComponent(codigo)}`, {
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
   * Supervisor: una sola petición para Detalle por Cliente.
   * Backend: GET /vendedor/supervisor/con-items-comprados
   */
  getVendedoresConItemsCompradosSupervisor(
    filtros?: DashboardFilters,
    opciones: VendedoresConItemsParams = {},
  ): Observable<any> {
    const params = this.buildVendedoresConItemsParams(filtros, opciones);

    console.debug('🔍 [CumplimientoService] Solicitando /vendedor/supervisor/con-items-comprados', {
      apiUrl: this.apiUrl,
      params: params.keys(),
    });

    return this.http
      .get<any>(`${this.apiUrl}/vendedor/supervisor/con-items-comprados`, { params })
      .pipe(
        timeout(30000),
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

          console.debug('✅ [CumplimientoService] /vendedor/supervisor/con-items-comprados respondió', {
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
            console.error(
              '⏱️ [CumplimientoService] TIMEOUT en /vendedor/supervisor/con-items-comprados (30s):',
              {
                apiUrl: this.apiUrl,
                params: params.keys(),
              },
            );
          } else {
            console.error('❌ [CumplimientoService] Error en /vendedor/supervisor/con-items-comprados:', {
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

  /** GET /cuota-categoria/vendedores → categorías de múltiples vendedores con filtros de fecha */
  getCuotaCategoriasPorVendedores(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);

    return this.http.get<any>(`${this.apiUrl}/cuota-categoria/vendedores`, { params }).pipe(
      map((res) => ({
        ...(res ?? {}),
        periodo: res?.periodo ?? {},
        detalle: Array.isArray(res?.detalle) ? res.detalle : [],
      })),
      catchError(() => of({ periodo: {}, detalle: [] })),
    );
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