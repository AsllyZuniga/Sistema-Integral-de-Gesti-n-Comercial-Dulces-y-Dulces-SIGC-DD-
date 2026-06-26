import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

@Injectable({
  providedIn: 'root',
})
export class CumplimientoSemanaService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  private valoresFiltro(arr: string[] | undefined | null, legacy: unknown): string[] {
    const desdeArray = Array.isArray(arr)
      ? arr.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    if (desdeArray.length) return desdeArray;

    return String(legacy ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private aplicarValoresMulti(
    params: HttpParams,
    csvKey: string,
    values: string[],
    repeatedKey?: string,
  ): HttpParams {
    const limpios = values.map((item) => String(item ?? '').trim()).filter(Boolean);
    if (!limpios.length) return params;

    params = params.set(csvKey, limpios.join(','));

    if (repeatedKey) {
      limpios.forEach((item) => {
        params = params.append(repeatedKey, item);
      });
    }

    return params;
  }

  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();

    if (!filtros) return params;
    if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);

    params = this.aplicarValoresMulti(
      params,
      'vendedor',
      this.valoresFiltro(filtros.vendedores, filtros.vendedor),
      'codVendedor',
    );
    params = this.aplicarValoresMulti(
      params,
      'proveedor',
      this.valoresFiltro(filtros.proveedores, filtros.proveedor),
      'codProveedor',
    );

    const categorias = this.valoresFiltro(filtros.categorias, filtros.categoria);
    params = this.aplicarValoresMulti(params, 'categorias', categorias, 'codCategoria');
    if (categorias.length) params = params.set('categoria', categorias.join(','));

    params = this.aplicarValoresMulti(
      params,
      'ciudad',
      this.valoresFiltro(filtros.ciudades, filtros.ciudad),
      'codCiudad',
    );
    if (filtros.linea) params = params.set('linea', filtros.linea);

    return params;
  }

  private buildParamsForMe(filtros?: DashboardFilters): HttpParams {
    let params = this.buildParams(filtros);
    params = params.delete('vendedor');
    params = params.delete('codVendedor');
    return params;
  }

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
   * GET /semana/cumplimiento/lineas (role-aware)
   * Devuelve { detallePorLinea: [...lineas con cuota y venta] }
   *
   * Issue #2: equivalente a `getLineasAdmin` mensual. Filtra por scope JWT:
   *   - admin ve todas las líneas
   *   - supervisor ve las de su equipo
   *   - vendedor ve solo las suyas
   */
  getLineasAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http.get<any>(`${this.apiUrl}/semana/cumplimiento/lineas`, { params }).pipe(
      map((res) => {
        if (res?.detallePorLinea) {
          res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
        }
        return res;
      }),
      catchError(() => of({ detallePorLinea: [] })),
    );
  }

  /**
   * GET /semana/cumplimiento/lineas/:codigoVendedor
   * Devuelve { codigoVendedor, detallePorLinea: [...] }
   */
  getLineasPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/lineas/${codigoVendedor}`, { params })
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
   * GET /semana/cumplimiento/ciudades (role-aware, consolidado)
   * Devuelve { detallePorCiudad: [...], resumen: {...}, periodo: {...} }
   *
   * Microtarea B5/B6: equivalente a `getCiudadesGlobal` mensual. Filtra por
   * scope JWT: admin ve todas, supervisor ve su equipo, vendedor ve solo lo suyo.
   */
  getCiudadesGlobal(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/ciudades`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorCiudad) {
            res.detallePorCiudad = Array.isArray(res.detallePorCiudad) ? res.detallePorCiudad : [];
          }
          return res;
        }),
        catchError(() => of({ detallePorCiudad: [] })),
      );
  }

  /**
   * GET /semana/cumplimiento/ciudades/:codigoVendedor
   * Devuelve { codigoVendedor, detallePorCiudad: [...] }
   */
  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/ciudades/${codigoVendedor}`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorCiudad) {
            res.detallePorCiudad = Array.isArray(res.detallePorCiudad) ? res.detallePorCiudad : [];
          }
          return res;
        }),
        catchError(() => of({ detallePorCiudad: [] })),
      );
  }

  // ─── CATEGORÍAS ──────────────────────────────────────────────────────────────

  /**
   * NOTA: getCuotaCategoriaPorVendedor eliminado tras consolidación
   * (Issue #1). Usar getCuotaCategoriaGeneral() de cumplimientoVentasMes.service.ts
   * que es role-aware desde el JWT. La vista semanal reutiliza el mismo
   * endpoint /api/cuota-categoria/general (los filtros de fecha en el
   * payload delimitan el período).
   */

  // ─── PRODUCTOS / ITEMS ───────────────────────────────────────────────────────

  /**
   * GET /semana/cumplimiento/vendedor/:codigoVendedor/productos
   * Devuelve { data: [...productos] }
   */
  getProductosPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/semana/cumplimiento/vendedor/${codigoVendedor}/productos`, {
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
    let params = this.buildParams(filtros);
    if (params.has('proveedor')) params = params.delete('proveedor');
    return this.http
      .get<any>(
        `${this.apiUrl}/semana/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoProveedor}`,
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
