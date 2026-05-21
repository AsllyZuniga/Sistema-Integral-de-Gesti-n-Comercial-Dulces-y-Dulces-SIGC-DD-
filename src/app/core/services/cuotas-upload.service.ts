import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CuotasUploadResponse {
  exitosas?: number;
  errores?: number;
  registrosExitosos?: number;
  registrosConError?: number;
  tiempoInicio?: number;
  tiempoFin?: number;
  tiempoTotalSegundos?: number;
  message?: string;
  mensaje?: string;
  error?: string;
}

export interface EliminarCuotasResponse {
  message?: string;
  mensaje?: string;
  deleted?: number;
  eliminadas?: number;
  affected?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CuotasUploadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  uploadCuotasVendedor(archivo: File): Observable<CuotasUploadResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.http.post<CuotasUploadResponse>(
      `${this.apiUrl}/import/cuotas/upload`,
      formData,
    );
  }

  uploadCuotasProveedor(
    archivo: File,
    fechaInicio: string,
    fechaFin: string,
  ): Observable<CuotasUploadResponse> {
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('fecha_inicio', fechaInicio);
    formData.append('fecha_fin', fechaFin);

    return this.http.post<CuotasUploadResponse>(
      `${this.apiUrl}/vendedor-cuota-proveedor/upload`,
      formData,
    );
  }

  eliminarCuotasProveedorPorFechas(
    fechaInicio: string,
    fechaFin: string,
  ): Observable<EliminarCuotasResponse | string> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);

    return this.http.delete<EliminarCuotasResponse | string>(
      `${this.apiUrl}/vendedor-cuota-proveedor/rango/por-fechas`,
      { params },
    );
  }

  uploadCuotasCategoria(archivo: File): Observable<CuotasUploadResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return this.http
      .post(`${this.apiUrl}/cuota-categoria-import/cargar`, formData, {
        responseType: 'text',
      })
      .pipe(
        map((responseText) => {
          const texto = String(responseText ?? '').trim();

          if (!texto) {
            return { message: 'Importación completada' } as CuotasUploadResponse;
          }

          if (texto.startsWith('{') || texto.startsWith('[')) {
            try {
              const parsed = JSON.parse(texto);
              return (parsed ?? {}) as CuotasUploadResponse;
            } catch {
              // Si el backend respondió texto plano, lo tratamos como mensaje exitoso.
            }
          }

          return { message: texto } as CuotasUploadResponse;
        }),
      );
  }

  eliminarCuotasCategoriaPorFechas(
    fechaInicio: string,
    fechaFin: string,
  ): Observable<EliminarCuotasResponse | string> {
    const params = new HttpParams()
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);

    return this.http.delete<EliminarCuotasResponse | string>(
      `${this.apiUrl}/vendedor-cuota-categoria/rango/por-fechas`,
      { params },
    );
  }
}