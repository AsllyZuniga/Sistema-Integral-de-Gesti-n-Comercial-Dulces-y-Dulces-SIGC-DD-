import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DashboardApi {
  private baseUrl = '/api/dashboard';

  constructor(private http: HttpClient) { }

  resumen(codigoVendedor: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/resumen/${codigoVendedor}`);
  }

  ventasProveedor(codigo: string, proveedor?: string) {
    return this.http.get(`${this.baseUrl}/ventas/proveedor/${codigo}`, {
      params: proveedor ? { proveedor } : {},
    });
  }

  ventasCiudad(codigo: string) {
    return this.http.get(`${this.baseUrl}/ventas/ciudad/${codigo}`);
  }

  ventasVendedorSupervisor(codigo: string) {
    return this.http.get(`${this.baseUrl}/ventas/vendedor/${codigo}`);
  }

  impactos(codigo: string) {
    return this.http.get(`${this.baseUrl}/impactos/${codigo}`);
  }

  devoluciones(codigo: string) {
    return this.http.get(`${this.baseUrl}/devoluciones/${codigo}`);
  }

  nivelServicio(codigo: string) {
    return this.http.get(`${this.baseUrl}/servicio/${codigo}`);
  }

  historicoProveedor(codigo: string, meses = 2) {
    return this.http.get(`${this.baseUrl}/historico/${codigo}?meses=${meses}`);
  }
}
