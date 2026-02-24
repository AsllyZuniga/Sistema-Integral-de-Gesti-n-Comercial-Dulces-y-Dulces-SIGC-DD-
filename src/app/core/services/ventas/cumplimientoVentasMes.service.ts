import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CumplimientoService {

  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // Cumplimiento general del mes (todos los vendedores)
  getCumplimientoMes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes/cumplimiento`);
  }

  // Cumplimiento del vendedor logueado
  getCumplimientoPorCodigo(codigo: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/mes/cumplimiento/${codigo}`);
  }

  // Cumplimiento por línea específica
  getCumplimientoPorLinea(codigoLinea: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/mes/cumplimiento/linea/${codigoLinea}`
    );
  }

  // Cumplimiento por vendedor y línea
  getCumplimientoPorVendedorYLinea(
    codigoVendedor: string,
    codigoLinea: string
  ): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoLinea}`
    );
  }

  // NUEVO ENDPOINT (EL QUE NECESITAS)
  getLineasPorVendedor(codigoVendedor: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/lineas`
    );
  }
}