import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';

export interface CuotaRegistro {
  id: number;
  monto: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  id_usuario: number | string;
}

@Injectable({ providedIn: 'root' })
export class CuotasCrudService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  private normalizar(registros: any[], idField: string, montoField: string): CuotaRegistro[] {
    return (Array.isArray(registros) ? registros : []).map((r: any) => ({
      id: r?.[idField] ?? r?.id,
      monto: r?.[montoField] ?? null,
      fecha_inicio: r?.fecha_inicio ?? null,
      fecha_fin: r?.fecha_fin ?? null,
      id_usuario: r?.id_usuario,
    }));
  }

  listarCuotaMesPorVendedor(idUsuario: string | number): Observable<CuotaRegistro[]> {
    return this.http.get<any[]>(`${this.apiUrl}/cuota-mes`).pipe(
      map((res) =>
        this.normalizar(res, 'id_cuotaMes', 'cuota_mes').filter(
          (c) => String(c.id_usuario) === String(idUsuario),
        ),
      ),
      catchError(() => of([])),
    );
  }

  listarCuotaSemanaPorVendedor(idUsuario: string | number): Observable<CuotaRegistro[]> {
    return this.http.get<any[]>(`${this.apiUrl}/cuota-semana`).pipe(
      map((res) =>
        this.normalizar(res, 'id_cuotaSemana', 'cuota_semana').filter(
          (c) => String(c.id_usuario) === String(idUsuario),
        ),
      ),
      catchError(() => of([])),
    );
  }

  listarCuotaDiaPorVendedor(idUsuario: string | number): Observable<CuotaRegistro[]> {
    return this.http.get<any[]>(`${this.apiUrl}/cuota-dia`).pipe(
      map((res) =>
        this.normalizar(res, 'id_cuotaDia', 'cuota_dia').filter(
          (c) => String(c.id_usuario) === String(idUsuario),
        ),
      ),
      catchError(() => of([])),
    );
  }

  eliminarCuotaMes(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/cuota-mes/${id}`);
  }

  eliminarCuotaSemana(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/cuota-semana/${id}`);
  }

  eliminarCuotaDia(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/cuota-dia/${id}`);
  }
}
