import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
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
   * Todos los vendedores
   */
  getCuotaDiaAdmin(params: CuotaDiaParams): Observable<CuotaDiaVendedor[]> {
    const httpParams = this.buildParams(params);

    console.debug('[CuotaDiaService] GET /api/cuota-dia/por-dia', {
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
    });

    return this.http.get<CuotaDiaResponse>(`${this.apiUrl}/por-dia`, { params: httpParams }).pipe(
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
   * Vendedores asignados al supervisor con información adicional
   */
  getCuotaDiaSupervisor(params: CuotaDiaParams): Observable<CuotaDiaSupervisorResponse> {
    const httpParams = this.buildParams(params);

    console.debug('[CuotaDiaService] GET /api/roles/cuota-dia/por-supervisor', {
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
      id_supervisor: params.idSupervisor,
    });

    return this.http.get<CuotaDiaSupervisorResponse>(`${this.apiRoles}/por-supervisor`, { params: httpParams }).pipe(
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
   *
   * Respuesta exitosa:
   *   { success, data: CuotaDiaVendedor[], message, vendedor: {...} }
   *
   * Errores manejados (no se propagan para no romper UI):
   *   - 401: Sin token
   *   - 403: Token válido pero rol ≠ 3
   *   - 404: No existe vendedor asociado al usuario
   */
  getCuotaDiaVendedor(params: CuotaDiaParams): Observable<CuotaDiaVendedor[]> {
    const httpParams = this.buildParams(params);

    console.debug('[CuotaDiaService] GET /api/roles/cuota-dia/por-vendedor', {
      fecha_inicio: params.fechaInicio,
      fecha_fin: params.fechaFin,
    });

    return this.http
      .get<CuotaDiaResponse>(`${this.apiRoles}/por-vendedor`, { params: httpParams })
      .pipe(
        tap((res: CuotaDiaResponse) => {
          console.debug('[CuotaDiaService] Respuesta vendedor raw:', {
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
        catchError((err: HttpErrorResponse) => {
          const status = err?.status;
          const mensaje = this.obtenerMensajeErrorVendedor(status);
          console.warn('[CuotaDiaService] Error en getCuotaDiaVendedor:', { status, mensaje });
          return of([]);
        }),
      );
  }

  /**
   * Devuelve un mensaje legible para los errores específicos del endpoint
   * /api/roles/cuota-dia/por-vendedor.
   */
  private obtenerMensajeErrorVendedor(status: number | undefined): string {
    switch (status) {
      case 401:
        return 'Sin token de autenticación. Inicia sesión nuevamente.';
      case 403:
        return 'Tu rol no tiene permisos para consultar la cuota diaria del vendedor.';
      case 404:
        return 'No existe un vendedor asociado al usuario autenticado.';
      default:
        return 'Error al obtener la cuota diaria del vendedor.';
    }
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
