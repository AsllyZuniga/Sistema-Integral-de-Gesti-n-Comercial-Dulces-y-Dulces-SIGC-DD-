import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay, of, catchError } from 'rxjs';
import { DashboardFilters, FilterOption } from '../../../shared/components/filters/filters.component';
import { enriquecerOpcionesSinDuplicadosVisuales } from '../../../shared/utils/filter-options.util';
import { normalizarTextoFiltro } from '../../../shared/utils/text-normalization.util';

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
        map((res) => (res?.success ? this.normalizarRespuesta(res.data) : null)),
        catchError((err) => {
          console.error('[FiltrosService] error:', err);
          return of(null);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.cache.set(key, req$);
    return req$;
  }


  private normalizarRespuesta(data: OpcionesFiltros | null | undefined): OpcionesFiltros | null {
    if (!data) return null;

    const vendedores = this.normalizarOpcionesVendedores(data.vendedores);

    return {
      periodo: data.periodo ?? { fechaInicio: '', fechaFin: '' },
      vendedores,
      proveedores: this.normalizarOpciones(data.proveedores, ['value', 'reporte_prov_con_obs', 'reporteProvConObs', 'codigo', 'codProveedor', 'proveedor'], ['label', 'nombre', 'nombreProveedor', 'proveedor']),
      categorias: this.normalizarOpciones(data.categorias, ['value', 'id_categoria', 'idCategoria', 'codCategoria', 'codigo'], ['label', 'categoria', 'nomCategoria', 'nombreCategoria']),
      ciudades: this.normalizarOpciones(data.ciudades, ['value', 'id_ciudad', 'idCiudad', 'codCiudad', 'codigo', 'cod'], ['label', 'ciudad', 'nomCiudad', 'nombreCiudad']),
    };
  }

  private normalizarOpcionesVendedores(items: any[] | null | undefined): FilterOption[] {
    const opciones = new Map<string, FilterOption>();
    const texto = (valor: unknown): string => String(valor ?? '').trim();
    const pick = (item: any, keys: string[]): string => {
      for (const key of keys) {
        const value = texto(item?.[key]);
        if (value) return value;
      }
      return '';
    };

    const valueKeys = ['value', 'codigo_vendedor', 'codVendedor', 'codigo', 'cod'];
    const labelKeys = ['label', 'nombre', 'nom_vendedor', 'nomVendedor', 'nombreVendedor'];

    for (const item of Array.isArray(items) ? items : []) {
      const rawValue = normalizarTextoFiltro(pick(item, valueKeys) || pick(item, labelKeys));
      const nombre = normalizarTextoFiltro(pick(item, labelKeys) || rawValue);
      if (!rawValue || !nombre) continue;

      const codigo = this.zeroPadCodigo(rawValue);
      if (!opciones.has(codigo)) {
        opciones.set(codigo, { value: codigo, label: `${codigo} ${nombre}` });
      }
    }

    return Array.from(opciones.values()).sort(
      (a, b) => Number(a.value) - Number(b.value),
    );
  }

  private zeroPadCodigo(valor: string): string {
    const codigo = valor.trim();
    if (!codigo) return '';
    return /^\d+$/.test(codigo) && codigo.length < 4 ? codigo.padStart(4, '0') : codigo;
  }

  private normalizarOpciones(items: any[] | null | undefined, valueKeys: string[], labelKeys: string[]): FilterOption[] {
    const opciones = new Map<string, FilterOption>();
    const tempList: FilterOption[] = [];
    const texto = (valor: unknown): string => String(valor ?? '').trim();
    const pick = (item: any, keys: string[]): string => {
      for (const key of keys) {
        const value = texto(item?.[key]);
        if (value) return value;
      }
      return '';
    };

    for (const item of Array.isArray(items) ? items : []) {
      // Normalizamos tanto el value como el label a UTF-8 limpio.
      // El backend puede enviar nombres con U+FFFD (�) por mismatch de
      // charset en la respuesta HTTP. Si dejamos el value sucio, el
      // filtro no matchea contra la base de datos (que sí está en UTF-8).
      const value = normalizarTextoFiltro(pick(item, valueKeys) || pick(item, labelKeys));
      const label = normalizarTextoFiltro(pick(item, labelKeys) || value);
      if (!value || !label) continue;
      if (!opciones.has(value)) {
        const opcion: FilterOption = { value, label };
        opciones.set(value, opcion);
        tempList.push(opcion);
      }
    }

    return enriquecerOpcionesSinDuplicadosVisuales(tempList);
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
