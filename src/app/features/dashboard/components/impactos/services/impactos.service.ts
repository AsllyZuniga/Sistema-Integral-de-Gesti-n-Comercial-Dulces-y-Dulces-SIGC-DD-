import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ImpactoCategoriaRow,
  ImpactoCanalRow,
  ImpactoProveedorRow,
  ImpactoVendedorRow,
  ImpactosResponse,
} from '../models/impactos.model';

@Injectable({
  providedIn: 'root',
})
export class ImpactosService {
  private mockProveedores: ImpactoProveedorRow[] = [
    { proveedor: 'Nestlé', cuotaImpactos: 5000, impactos: 4200, porcCump: 84.0, proyeccionImpactos: 5100 },
    { proveedor: 'Colombina', cuotaImpactos: 4000, impactos: 3800, porcCump: 95.0, proyeccionImpactos: 4100 },
    { proveedor: 'Ricolino', cuotaImpactos: 3500, impactos: 2900, porcCump: 82.9, proyeccionImpactos: 3600 },
    { proveedor: 'Luker', cuotaImpactos: 3000, impactos: 3100, porcCump: 103.3, proyeccionImpactos: 3200 },
    { proveedor: 'Compañía Nacional de Chocolates', cuotaImpactos: 2500, impactos: 2100, porcCump: 84.0, proyeccionImpactos: 2600 },
  ];

  private mockCategorias: ImpactoCategoriaRow[] = [
    { categoria: 'Chocolates', cuotaImpactos: 6000, impactos: 5400, porcCump: 90.0, proyeccionImpactos: 6200 },
    { categoria: 'Gomitas', cuotaImpactos: 4500, impactos: 4100, porcCump: 91.1, proyeccionImpactos: 4600 },
    { categoria: 'Caramelos', cuotaImpactos: 3000, impactos: 2700, porcCump: 90.0, proyeccionImpactos: 3100 },
    { categoria: 'Galletas', cuotaImpactos: 2500, impactos: 2200, porcCump: 88.0, proyeccionImpactos: 2600 },
    { categoria: 'Confitería', cuotaImpactos: 2000, impactos: 1700, porcCump: 85.0, proyeccionImpactos: 2100 },
  ];

  private mockCanales: ImpactoCanalRow[] = [
    { canal: 'Tiendas independientes', impactos: 8500 },
    { canal: 'Supermercados', impactos: 6200 },
    { canal: 'Minimarkets', impactos: 3400 },
    { canal: 'Distribuidoras', impactos: 2800 },
    { canal: 'Venta directa', impactos: 1900 },
  ];

  private mockVendedores: ImpactoVendedorRow[] = [
    { vendedor: '0001 - Juan Pérez', cuotaImpactos: 8000, impactos: 7200, porcCump: 90.0, proyeccionImpactos: 8500 },
    { vendedor: '0002 - María López', cuotaImpactos: 7500, impactos: 6800, porcCump: 90.7, proyeccionImpactos: 7800 },
    { vendedor: '0003 - Carlos García', cuotaImpactos: 6000, impactos: 5100, porcCump: 85.0, proyeccionImpactos: 6200 },
    { vendedor: '0004 - Ana Martínez', cuotaImpactos: 5500, impactos: 5200, porcCump: 94.5, proyeccionImpactos: 5700 },
    { vendedor: '0005 - Pedro Sánchez', cuotaImpactos: 4500, impactos: 3900, porcCump: 86.7, proyeccionImpactos: 4700 },
  ];

  getImpactosPorProveedor(): Observable<ImpactosResponse> {
    return of({
      rows: this.mockProveedores,
      total: this.mockProveedores.length,
    });
  }

  getImpactosPorCategoria(): Observable<ImpactosResponse> {
    return of({
      rows: this.mockCategorias,
      total: this.mockCategorias.length,
    });
  }

  getImpactosPorCanal(): Observable<ImpactosResponse> {
    return of({
      rows: this.mockCanales,
      total: this.mockCanales.length,
    });
  }

  getImpactosPorVendedor(): Observable<ImpactosResponse> {
    return of({
      rows: this.mockVendedores,
      total: this.mockVendedores.length,
    });
  }
}
