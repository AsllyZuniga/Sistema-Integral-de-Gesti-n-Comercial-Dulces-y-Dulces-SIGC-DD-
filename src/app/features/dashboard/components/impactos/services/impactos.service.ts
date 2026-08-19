import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ImpactoCategoriaRow,
  ImpactoProveedorRow,
  ImpactoVendedorRow,
  ImpactosResponse,
} from '../models/impactos.model';

export interface ImpactosFiltros {
  fechaInicio?: string;
  fechaFin?: string;
  tipoPeriodo?: string;
  vendedor?: string;
  proveedor?: string;
  categoria?: string;
  canal?: string;
  ciudad?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ImpactosService {
  private apiUrl = '/api/impactos';

  constructor(private http: HttpClient) {}

  private buildParams(filtros?: ImpactosFiltros): HttpParams {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
      if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
      if (filtros.tipoPeriodo) params = params.set('tipoPeriodo', filtros.tipoPeriodo);
      if (filtros.vendedor) params = params.set('vendedor', filtros.vendedor);
      if (filtros.proveedor) params = params.set('proveedor', filtros.proveedor);
      if (filtros.categoria) params = params.set('categoria', filtros.categoria);
      if (filtros.canal) params = params.set('canal', filtros.canal);
      if (filtros.ciudad) params = params.set('ciudad', filtros.ciudad);
    }
    return params;
  }

  getImpactosPorVendedor(filtros?: ImpactosFiltros): Observable<ImpactosResponse> {
    return this.http
      .get<ImpactosResponse>(`${this.apiUrl}/vendedores`, { params: this.buildParams(filtros) })
      .pipe(map((res) => ({
        success: res.success ?? true,
        tipo: res.tipo ?? 'vendedores',
        rows: res.rows ?? [],
        total: res.total ?? 0,
      })));
  }

  getImpactosPorProveedor(filtros?: ImpactosFiltros): Observable<ImpactosResponse> {
    return this.http
      .get<ImpactosResponse>(`${this.apiUrl}/proveedores`, { params: this.buildParams(filtros) })
      .pipe(map((res) => ({
        success: res.success ?? true,
        tipo: res.tipo ?? 'proveedores',
        rows: res.rows ?? [],
        total: res.total ?? 0,
      })));
  }

  getImpactosPorCategoria(filtros?: ImpactosFiltros): Observable<ImpactosResponse> {
    return this.http
      .get<ImpactosResponse>(`${this.apiUrl}/categorias`, { params: this.buildParams(filtros) })
      .pipe(map((res) => ({
        success: res.success ?? true,
        tipo: res.tipo ?? 'categorias',
        rows: res.rows ?? [],
        total: res.total ?? 0,
      })));
  }
}

export type {
  ImpactoVendedorRow,
  ImpactoProveedorRow,
  ImpactoCategoriaRow,
};