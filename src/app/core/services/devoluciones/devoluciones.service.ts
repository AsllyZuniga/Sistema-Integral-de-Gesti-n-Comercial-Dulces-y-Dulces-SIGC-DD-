/* import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DevolucionesService {
  private http = inject(HttpClient);
  private apiUrl = '/api/devoluciones';

  private buildParams(filtros: any): HttpParams {
    let params = new HttpParams();
    if (filtros?.vendedor) params = params.set('vendedor', filtros.vendedor);
    if (filtros?.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros?.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros?.proveedor) params = params.set('proveedor', filtros.proveedor);
    if (filtros?.categoria) params = params.set('categoria', filtros.categoria);
    if (filtros?.ciudad) params = params.set('ciudad', filtros.ciudad);
    return params;
  }

  getPorCliente(filtros: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/por-cliente`, { params: this.buildParams(filtros) });
  }

  getPorProveedor(filtros: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/por-proveedor`, { params: this.buildParams(filtros) });
  }

  getPorCiudad(filtros: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/por-ciudad`, { params: this.buildParams(filtros) });
  }
} */