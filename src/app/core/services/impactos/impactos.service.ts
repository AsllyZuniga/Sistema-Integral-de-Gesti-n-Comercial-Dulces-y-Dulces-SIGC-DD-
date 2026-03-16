import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

@Injectable({
  providedIn: 'root',
})
export class ImpactosService {
  private apiUrl = 'https://api.sisferahub.com';

  constructor(private http: HttpClient) { }

  // ── Helper: construye HttpParams con filtros opcionales ──────────
  private buildParams(filtros?: DashboardFilters, extra?: Record<string, string>): HttpParams {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
      if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
      if (filtros.vendedor) params = params.set('vendedor', filtros.vendedor);
      if (filtros.proveedor) params = params.set('proveedor', filtros.proveedor);
      if (filtros.categoria) params = params.set('categoria', filtros.categoria);
      if (filtros.ciudad) params = params.set('ciudad', filtros.ciudad);
    }
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        if (v) params = params.set(k, v);
      });
    }
    return params;
  }

  // ── Impactos agrupados por proveedor ─────────────────────────────
  getPorProveedor(filtros?: DashboardFilters): Observable<any[]> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/impactos/proveedor`, { params })
      .pipe(
        map((res) => {
          if (Array.isArray(res)) return res;
          if (Array.isArray(res?.data)) return res.data;
          if (Array.isArray(res?.impactos)) return res.impactos;
          return [];
        }),
        catchError(() => of([])),
      );
  }

  // ── Impactos agrupados por ciudad ────────────────────────────────
  getPorCiudad(filtros?: DashboardFilters): Observable<any[]> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/impactos/ciudad`, { params })
      .pipe(
        map((res) => {
          if (Array.isArray(res)) return res;
          if (Array.isArray(res?.data)) return res.data;
          if (Array.isArray(res?.impactos)) return res.impactos;
          return [];
        }),
        catchError(() => of([])),
      );
  }

  // ── Detalle por producto/proveedor (con filtro de proveedor) ─────
  getDetalle(filtros?: DashboardFilters & { proveedor?: string }): Observable<any[]> {
    const { proveedor, ...resto } = filtros ?? {};
    const params = this.buildParams(resto as DashboardFilters, proveedor ? { proveedor } : {});
    return this.http
      .get<any>(`${this.apiUrl}/impactos/detalle`, { params })
      .pipe(
        map((res) => {
          if (Array.isArray(res)) return res;
          if (Array.isArray(res?.data)) return res.data;
          if (Array.isArray(res?.impactos)) return res.impactos;
          return [];
        }),
        catchError(() => of([])),
      );
  }
}