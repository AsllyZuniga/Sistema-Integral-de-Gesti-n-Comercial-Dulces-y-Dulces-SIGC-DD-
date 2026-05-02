import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CuotasUploadService {
  private apiUrl = environment.apiUrl;
  private readonly cuotasVendedorUploadUrl = 'http://localhost:3000/import/cuotas/upload';

  constructor(private http: HttpClient) {}

  /**
   * Carga cuotas mensuales por vendedor
   * Endpoint: POST /import/cuotas/upload
   */
  uploadCuotasVendedor(archivo: File): Observable<CuotasUploadResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<CuotasUploadResponse>(this.cuotasVendedorUploadUrl, formData);
  }

  /**
   * Carga cuotas por proveedor/línea
   * Endpoint: POST /vendedor-cuota-proveedor/upload
   * Formato esperado: Línea, Cuota Línea
   * Requiere: fecha_inicio y fecha_fin en formato YYYY-MM-DD
   */
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

  /**
   * Carga cuotas por categoría
   * Endpoint: POST /cuota-categoria-import/cargar
   * Formato esperado: Categoría, Cuota
   */
  uploadCuotasCategoria(archivo: File): Observable<CuotasUploadResponse> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<CuotasUploadResponse>(
      `${this.apiUrl}/cuota-categoria-import/cargar`,
      formData,
    );
  }
}
