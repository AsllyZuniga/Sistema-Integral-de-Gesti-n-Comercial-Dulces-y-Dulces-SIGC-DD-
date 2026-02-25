import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CumplimientoService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getCumplimientoMes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mes/cumplimiento`).pipe(
      map(res => Array.isArray(res) ? res : []),
      catchError(() => of([]))
    );
  }

  getCumplimientoPorCodigo(codigo: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mes/cumplimiento/${codigo}`).pipe(
      catchError(() => of(null))
    );
  }

  getLineasPorVendedor(codigoVendedor: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/lineas`).pipe(
      map(res => {
        // Aseguramos que la propiedad detallePorLinea siempre sea un array
        if (res && res.detallePorLinea) {
          res.detallePorLinea = Array.isArray(res.detallePorLinea) ? res.detallePorLinea : [];
        }
        return res;
      }),
      catchError(() => of({ detallePorLinea: [] }))
    );
  }
}