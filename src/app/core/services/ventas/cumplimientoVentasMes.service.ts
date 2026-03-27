import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

@Injectable({
  providedIn: 'root',
})
export class CumplimientoService {
  private apiUrl = 'http://localhost:3000';

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
}