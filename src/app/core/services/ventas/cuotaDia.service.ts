import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, tap } from 'rxjs';

export interface CuotaDiaVendedor {
  id_cuotaDia: string;
  cuota_dia: string;
  fecha_inicio: string;
  fecha_fin: string;
  id_usuario: number;
  usuario: {
    id_usuario: number;
    username: string;
    estado: boolean;
    vendedor: {
      id_vendedor: number;
      codigo_vendedor: string;
      nombre: string;
    };
  };
  venta_acumulada_dia?: number;
  pct_cumplimiento?: number;
  proye_venta?: number;
  dias_corridos?: number;
  dias_habiles?: number;
}

export interface CuotaDiaSupervisorInfo {
  id_usuario: number;
  username: string;
}

export interface CuotaDiaSupervisorResponse {
  success: boolean;
  data: CuotaDiaVendedor[];
  message: string;
  supervisor?: CuotaDiaSupervisorInfo;
  total_vendedores?: number;
}

export interface CuotaDiaResponse {
  success: boolean;
  data: CuotaDiaVendedor[];
  message: string;
  vendedor?: {
    id_vendedor?: number;
    codigo_vendedor?: string;
    nombre?: string;
  };
}

export interface CuotaDiaParams {
  fechaInicio: string;
  fechaFin: string;
  idSupervisor?: string | number;
}

@Injectable({
  providedIn: 'root',
})
export class CuotaDiaService {
  private apiUrl = '/api/cuota-dia';
  private apiRoles = '/api/roles/cuota-dia';

  constructor(private http: HttpClient) {}

  /**
   * ADMIN: GET /api/cuota-dia/por-dia
   * Todos los vendedores. Conserva errores HTTP para mostrar mensajes específicos en el dashboard.
   */
  getCuotaDiaAdminResponse(params: CuotaDiaParams): Observable<CuotaDiaResponse> {
    const httpParams = this.buildParams(params);

    console.debug('[CuotaDiaService] GET /api/cuota-dia/por-dia', {
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
    });

    return this.http.get<CuotaDiaResponse>(`${this.apiUrl}/por-dia`, { params: httpParams });
  }

  /**
   * ADMIN: GET /api/cuota-dia/por-dia
   * Variante segura para tablas/gráficas: si falla, retorna arreglo vacío.
   */
  getCuotaDiaAdmin(params: CuotaDiaParams): Observable<CuotaDiaVendedor[]> {
    return this.getCuotaDiaAdminResponse(params).pipe(
      tap((res: CuotaDiaResponse) => {
        console.debug('[CuotaDiaService] Respuesta raw:', {
          success: res?.success,
          dataLength: res?.data?.length ?? 0,
          message: res?.message,
        });
      }),
      map((res: CuotaDiaResponse) => {
        const data = res?.success && Array.isArray(res.data) ? res.data : [];
        console.debug('[CuotaDiaService] Data retornada:', data.length, 'registros');
        return data;
      }),
      catchError((err) => {
        console.error('[CuotaDiaService] Error en getCuotaDiaAdmin:', err);
        return of([]);
      }),
    );
  }

  /**
   * SUPERVISOR: GET /api/roles/cuota-dia/por-supervisor?fecha_inicio=X&fecha_fin=Y&id_supervisor=Z
   * Vendedores asignados al supervisor con información adicional. Conserva errores HTTP.
   */
  getCuotaDiaSupervisorResponse(params: CuotaDiaParams): Observable<CuotaDiaSupervisorResponse> {
    const httpParams = this.buildParams(params);

    console.debug('[CuotaDiaService] GET /api/roles/cuota-dia/por-supervisor', {
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
      id_supervisor: params.idSupervisor,
    });

    return this.http.get<CuotaDiaSupervisorResponse>(`${this.apiRoles}/por-supervisor`, { params: httpParams });
  }

  /**
   * SUPERVISOR: GET /api/roles/cuota-dia/por-supervisor?fecha_inicio=X&fecha_fin=Y&id_supervisor=Z
   * Variante segura para tablas/gráficas: si falla, retorna respuesta vacía.
   */
  getCuotaDiaSupervisor(params: CuotaDiaParams): Observable<CuotaDiaSupervisorResponse> {
    return this.getCuotaDiaSupervisorResponse(params).pipe(
      tap((res: CuotaDiaSupervisorResponse) => {
        console.debug('[CuotaDiaService] Respuesta supervisor raw:', {
          success: res?.success,
          dataLength: res?.data?.length ?? 0,
          message: res?.message,
          supervisor: res?.supervisor,
          totalVendedores: res?.total_vendedores,
        });
      }),
      catchError((err) => {
        console.error('[CuotaDiaService] Error en getCuotaDiaSupervisor:', err);
        return of({
          success: false,
          data: [],
          message: 'Error al obtener cuotas del supervisor',
          supervisor: undefined,
          total_vendedores: 0,
        });
      }),
    );
  }

  /**
   * VENDEDOR: GET /api/roles/cuota-dia/por-vendedor
   * Solo el vendedor autenticado (extraído del token).
   * Este método conserva el error HTTP para que el dashboard pueda mostrar
   * mensajes específicos 401/403/404 y evitar cards con valores viejos.
   */
  getCuotaDiaVendedorResponse(params: CuotaDiaParams): Observable<CuotaDiaResponse> {
    const httpParams = this.buildParams(params);

    return this.http.get<CuotaDiaResponse>(`${this.apiRoles}/por-vendedor`, {
      params: httpParams,
    });
  }

  /**
   * VENDEDOR: GET /api/roles/cuota-dia/por-vendedor
   * Variante segura para tablas/gráficas: si falla, retorna arreglo vacío.
   */
  getCuotaDiaVendedor(params: CuotaDiaParams): Observable<CuotaDiaVendedor[]> {
    return this.getCuotaDiaVendedorResponse(params).pipe(
      map((res) => (res?.success && Array.isArray(res.data) ? res.data : [])),
      catchError((err) => {
        console.error('[CuotaDiaService] Error en getCuotaDiaVendedor:', err);
        return of([]);
      }),
    );
  }

  private buildParams(params: CuotaDiaParams): HttpParams {
    let httpParams = new HttpParams();

    if (params.fechaInicio) {
      httpParams = httpParams.set('fecha_inicio', params.fechaInicio);
    }

    if (params.fechaFin) {
      httpParams = httpParams.set('fecha_fin', params.fechaFin);
    }

    if (params.idSupervisor) {
      httpParams = httpParams.set('id_supervisor', String(params.idSupervisor));
    }

    return httpParams;
  }
}
