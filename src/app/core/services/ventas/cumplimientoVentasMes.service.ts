import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

@Injectable({
  providedIn: 'root',
})
export class CumplimientoService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // ── Helper: construye HttpParams con filtros opcionales ──────────
  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;

    if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin)    params = params.set('fechaFin',    filtros.fechaFin);
    if (filtros.vendedor)    params = params.set('vendedor',    filtros.vendedor);
    if (filtros.proveedor)   params = params.set('proveedor',   filtros.proveedor);
    if (filtros.categoria)   params = params.set('categoria',   filtros.categoria);
    if (filtros.ciudad)      params = params.set('ciudad',      filtros.ciudad);

    return params;
  }

  // ── Todos los vendedores ─────────────────────────────────────────
  getCumplimientoMes(filtros?: DashboardFilters): Observable<any[]> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any[]>(`${this.apiUrl}/mes/cumplimiento`, { params })
      .pipe(
        map((res) => (Array.isArray(res) ? res : [])),
        catchError(() => of([])),
      );
  }

  // ── Cumplimiento de un vendedor específico ───────────────────────
  getCumplimientoPorCodigo(codigo: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/${codigo}`, { params })
      .pipe(
        catchError(() => of(null)),
      );
  }

  // ── Desglose por línea ───────────────────────────────────────────
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

  // ── Desglose por ciudad ──────────────────────────────────────────
  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/ciudades`, { params })
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

  // ── Detalle por producto ─────────────────────────────────────────
  getProductosPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/productos`, { params })
      .pipe(
        map((res) => {
          // Normalizar: el resto del código espera res.data
          if (res?.detallePorProducto) {
            res.data = Array.isArray(res.detallePorProducto)
              ? res.detallePorProducto
              : [];
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
}