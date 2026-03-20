import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UsuariosService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  listarSupervisores(): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/supervisores`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  listarVendedores(): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/vendedores`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  obtenerVendedoresDelSupervisor(idSupervisor: string): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/supervisores/${idSupervisor}/vendedores`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  asignarSupervisor(idVendedor: string, idSupervisor: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/vendedores/${idVendedor}/supervisor`, {
      idSupervisor,
    });
  }
}
