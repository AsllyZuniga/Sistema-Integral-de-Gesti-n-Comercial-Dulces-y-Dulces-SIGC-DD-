import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, of, catchError } from 'rxjs';
import { DashboardFilters, FilterOption } from '../../../shared/components/filters/filters.component';

export interface OpcionesFiltros {
  periodo: { fechaInicio: string; fechaFin: string };
  vendedores: FilterOption[];
  proveedores: FilterOption[];
  categorias: FilterOption[];
  ciudades: FilterOption[];
}

export interface FiltrosOpcionesParams {
  fechaInicio?: string;
  fechaFin?: string;
  codVendedor?: string[];
  codProveedor?: string[];
  codCategoria?: string[];
  codCiudad?: string[];
}

/**
 * Servicio que re-puebla los 4 desplegables del dashboard
 * (vendedor, proveedor, categoría, ciudad) en cascada a partir
 * de los filtros ya aplicados y del rol del JWT.
 *
 * El backend ya hace el scope role-aware (admin/equipo/propio)
 * y la cascada AND/OR; este servicio solo arma los query params
 * y cachea la última respuesta por clave.
 */
@Injectable({
  providedIn: 'root',
})
export class FiltrosService {
  private apiUrl = '/api/filtros/opciones';
  private cache = new Map<string, Observable<OpcionesFiltros | null>>();

  constructor(private http: HttpClient) {}

  /**
   * Limpia la cache. Llamar cuando se cambia de rol o se hace logout.
   */
  invalidarCache(): void {
    this.cache.clear();
  }

  /**
   * Construye los query params para el endpoint /api/filtros/opciones.
   * Acepta arrays vía `filtros.vendedores[]` (nuevo) o `filtros.vendedor`
   * (legacy single) y los serializa repetidos (`?codVendedor=0001&codVendedor=0150`)
   * que es lo que espera el backend.
   */
  buildParams(params: FiltrosOpcionesParams): HttpParams {
    let httpParams = new HttpParams();

    if (params.fechaInicio) httpParams = httpParams.set('fechaInicio', params.fechaInicio);
    if (params.fechaFin) httpParams = httpParams.set('fechaFin', params.fechaFin);

    const appendAll = (key: string, values: string[] | undefined | null): void => {
      if (!Array.isArray(values)) return;
      values
        .map((v) => String(v ?? '').trim())
        .filter((v) => v.length > 0)
        .forEach((v) => {
          httpParams = httpParams.append(key, v);
        });
    };

    appendAll('codVendedor', params.codVendedor);
    appendAll('codProveedor', params.codProveedor);
    appendAll('codCategoria', params.codCategoria);
    appendAll('codCiudad', params.codCiudad);

    return httpParams;
  }

  /**
   * Toma un `DashboardFilters` (con arrays o escalares legacy) y arma
   * los arrays limpios que necesita el endpoint.
   */
  fromDashboardFilters(filtros: DashboardFilters | null | undefined): FiltrosOpcionesParams {
    if (!filtros) return {};
    const norm = (arr: string[] | undefined | null): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map((v) => String(v ?? '').trim()).filter(Boolean);
    };

    const codVendedor: string[] = filtros.vendedores && filtros.vendedores.length
      ? norm(filtros.vendedores)
      : (filtros.vendedor ? [String(filtros.vendedor).trim()] : []);

    const codProveedor: string[] = filtros.proveedores && filtros.proveedores.length
      ? norm(filtros.proveedores)
      : (filtros.proveedor ? [String(filtros.proveedor).trim()] : []);

    const codCategoria: string[] = filtros.categorias && filtros.categorias.length
      ? norm(filtros.categorias)
      : (filtros.categoria ? [String(filtros.categoria).trim()] : []);

    const codCiudad: string[] = filtros.ciudades && filtros.ciudades.length
      ? norm(filtros.ciudades)
      : (filtros.ciudad ? [String(filtros.ciudad).trim()] : []);

    return {
      fechaInicio: filtros.fechaInicio || undefined,
      fechaFin: filtros.fechaFin || undefined,
      codVendedor: codVendedor.length ? codVendedor : undefined,
      codProveedor: codProveedor.length ? codProveedor : undefined,
      codCategoria: codCategoria.length ? codCategoria : undefined,
      codCiudad: codCiudad.length ? codCiudad : undefined
    };
  }

  /**
   * Llama al endpoint con cache por clave. Devuelve `null` si hay error
   * de red (el caller decide qué hacer; normalmente mostrar vacíos).
   */
  getOpciones(params: FiltrosOpcionesParams): Observable<OpcionesFiltros | null> {
    const key = this.cacheKey(params);
    const cached = this.cache.get(key);
    if (cached) return cached;

    const httpParams = this.buildParams(params);
    const req$ = this.http
      .get<{ success: boolean; data: OpcionesFiltros }>(this.apiUrl, { params: httpParams })
      .pipe(
        map((res) => (res?.success ? res.data : null)),
        catchError((err) => {
          console.error('[FiltrosService] error:', err);
          return of(null);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.cache.set(key, req$);
    return req$;
  }

  private cacheKey(params: FiltrosOpcionesParams): string {
    const join = (arr?: string[]): string =>
      Array.isArray(arr) ? [...arr].sort().join('|') : '';
    return [
      params.fechaInicio || '',
      params.fechaFin || '',
      join(params.codVendedor),
      join(params.codProveedor),
      join(params.codCategoria),
      join(params.codCiudad)
    ].join('::');
  }
}
