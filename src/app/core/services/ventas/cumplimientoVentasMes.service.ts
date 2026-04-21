import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class CumplimientoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;
    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin)    params = params.set('fechaFin',    filtros.fechaFin);
    if (filtros?.vendedor)    params = params.set('vendedor',    filtros.vendedor);
    if (filtros?.proveedor)   params = params.set('proveedor',   filtros.proveedor);
    if (filtros?.categoria)   params = params.set('categoria',   filtros.categoria);
    if (filtros?.ciudad)      params = params.set('ciudad',      filtros.ciudad);
    if (filtros?.linea)       params = params.set('linea',       filtros.linea);
    return params;
  }

  // ─── NUEVOS: usados por DashboardComponent ───────────────────────────────────

  /** Admin: GET /mes/cumplimiento/front → { periodo, detalle: [...vendedores, TOTALES] } */
  getCumplimientoMesAdmin(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/front`, { params })
      .pipe(catchError(() => of({ detalle: [] })));
  }

  /** Vendedor: GET /mes/cumplimiento/front/me → { periodo, detalle: [vendedor, TOTALES] } */
  getCumplimientoMesVendedor(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/front/me`, { params })
      .pipe(catchError(() => of({ detalle: [] })));
  }

  // ─── EXISTENTES: usados por VentasComponent ──────────────────────────────────

  getCumplimientoMes(filtros?: DashboardFilters): Observable<any[]> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any[]>(`${this.apiUrl}/mes/cumplimiento`, { params })
      .pipe(
        map((res) => (Array.isArray(res) ? res : [])),
        catchError(() => of([])),
      );
  }

  getCumplimientoPorCodigo(codigo: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
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
          if (res?.detallePorLinea) res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
          return res;
        }),
        catchError(() => of({ detallePorLinea: [] })),
      );
  }

  getDetallePorLinea(codigoVendedor: string, codigoLinea: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoLinea}`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorLinea) res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
          return res;
        }),
        catchError(() => of({ detallePorLinea: [] })),
      );
  }

  getDetallePorLineaProveedor(codigoVendedor: string, codigoProveedor: string, filtros?: DashboardFilters): Observable<any> {
    let params = this.buildParams(filtros);
    if (params.has('proveedor')) params = params.delete('proveedor');
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoProveedor}`, { params })
      .pipe(catchError(() => of(null)));
  }

  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/ciudades`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorCiudad) res.detallePorCiudad = Array.isArray(res.detallePorCiudad) ? res.detallePorCiudad : [];
          return res;
        }),
        catchError(() => of({ detallePorCiudad: [] })),
      );
  }

  getDetallePorCiudad(codigoVendedor: string, codigoCiudad: string, filtros?: DashboardFilters): Observable<any> {
    let params = this.buildParams(filtros);
    if (params.has('ciudad')) params = params.delete('ciudad');

    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/ciudad/${codigoCiudad}`, { params })
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

  getProductosPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/productos`, { params })
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

  getCuotaCategoriaPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    let params = this.buildParams(filtros);
    if (params.has('vendedor')) params = params.delete('vendedor');

    const codigo = String(codigoVendedor ?? '').trim();
    if (!codigo) return of({ detalle: [] });

    return this.http
      .get<any>(`${this.apiUrl}/cuota-categoria/vendedor/${encodeURIComponent(codigo)}`, { params })
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
    if (params.has('vendedor')) params = params.delete('vendedor');

    const id = String(idVendedor ?? '').trim();

    if (!id) {
      return of({ data: [] });
    }

    const endpoint = `${this.apiUrl}/cliente/productos-por-cliente/vendedor/${encodeURIComponent(id)}`;

    return this.http
      .get<any>(endpoint, { params })
      .pipe(
        map((res) => {
          const data = Array.isArray(res)
            ? res
            : Array.isArray(res?.data)
              ? res.data
              : Array.isArray(res?.detalle)
                ? res.detalle
                : [];

          const normalizarIdVendedor = (valor: unknown): string => {
            const raw = String(valor ?? '').trim();
            if (!raw) return '';
            return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
          };

          const idObjetivo = normalizarIdVendedor(id);
          const dataConIdVendedor = data.filter((row: any) => {
            const idRow = row?.id_vendedor ?? row?.idVendedor ?? row?.vendedor_id ?? row?.idVendedorAsociado;
            return idRow !== null && idRow !== undefined;
          });

          const dataFiltrada = !idObjetivo || dataConIdVendedor.length === 0
            ? data
            : dataConIdVendedor.filter((row: any) => {
                const idRow = row?.id_vendedor ?? row?.idVendedor ?? row?.vendedor_id ?? row?.idVendedorAsociado;
                return normalizarIdVendedor(idRow) === idObjetivo;
              });

          return { ...(res ?? {}), data: dataFiltrada };
        }),
        catchError(() => of({ data: [] })),
      );
  }

  getVendedores(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.apiUrl}/vendedor`)
      .pipe(
        map((res) => (Array.isArray(res) ? res.filter((v: any) => v.status !== false) : [])),
        catchError(() => of([])),
      );
  }

  getProveedores(): Observable<any[]> {
    return this.http
      .get<any[]>(`${this.apiUrl}/proveedor`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : [])),
        catchError(() => of([])),
      );
  }

  /** GET /cuota-categoria/vendedores → categorías de múltiples vendedores con filtros de fecha */
  getCuotaCategoriasPorVendedores(filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/cuota-categoria/vendedores`, { params })
      .pipe(
        map((res) => ({
          ...(res ?? {}),
          periodo: res?.periodo ?? {},
          detalle: Array.isArray(res?.detalle) ? res.detalle : [],
        })),
        catchError(() => of({ periodo: {}, detalle: [] })),
      );
  }
}