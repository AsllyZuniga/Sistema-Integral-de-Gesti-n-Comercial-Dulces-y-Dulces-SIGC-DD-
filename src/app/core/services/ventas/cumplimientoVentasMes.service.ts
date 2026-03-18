import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { DashboardFilters } from '../../../shared/components/filters/filters.component';

@Injectable({
  providedIn: 'root',
})
export class CumplimientoService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  private buildParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();

   
    
    if (!filtros) {
      console.warn('⚠️ Filtros es undefined - NO se agregarán parámetros');
      
      return params;
    }
    
    console.log('📋 Filtros entrada:', filtros);
    console.log('');
    
    // Fecha inicio
    if (filtros?.fechaInicio) {
      params = params.set('fechaInicio', filtros.fechaInicio);
     
    }
    
    // Fecha fin
    if (filtros?.fechaFin) {
      params = params.set('fechaFin', filtros.fechaFin);
      
    }
    
    // Vendedor
    if (filtros?.vendedor) {
      params = params.set('vendedor', filtros.vendedor);
      
    }
    
    // PROVEEDOR - CRÍTICO
    if (filtros?.proveedor) {
     
      params = params.set('proveedor', filtros.proveedor);
    } else {
      
    }
    
    // Categoría
    if (filtros?.categoria) {
      params = params.set('categoria', filtros.categoria);
     
    }
    
    // CIUDAD - IMPORTANTE
    if (filtros?.ciudad) {
      params = params.set('ciudad', filtros.ciudad);
      console.log(`  ✅ ciudad: "${filtros.ciudad}"`);
    } else {
     
    }
    
    // LÍNEA
    if (filtros?.linea) {
      params = params.set('linea', filtros.linea);
      
    }

    console.log('');
    const paramsString = params.toString();
    console.log('📤 QUERY STRING FINAL:', paramsString);
    console.log(`   (URL completa sería: /mes/cumplimiento/front/me?${paramsString})`);
    console.groupEnd();

    return params;
  }

  getCumplimientoMes(filtros?: DashboardFilters): Observable<any[]> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any[]>(`${this.apiUrl}/mes/cumplimiento`, { params })
      .pipe(
        map((res) => (Array.isArray(res) ? res : [])),
        catchError(() => of([])),
      );
  }

  getCumplimientoPorCodigo(codigo: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    
    
    const paramsObj = params.keys().reduce((acc: any, key: string) => {
      acc[key] = params.get(key);
      return acc;
    }, {});
    console.table(paramsObj);
    
    const queryString = params.toString();
    
    
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/front/me`, { params })
      .pipe(
        catchError((err) => {
          console.error('❌ Error en getCumplimientoPorCodigo:', err);
          return of(null);
        }),
      );
  }

  getLineasPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/lineas`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorLinea) {
            res.detallePorLinea = Array.isArray(res.detallePorLinea)
              ? res.detallePorLinea : [];
          }
          return res;
        }),
        catchError(() => of({ detallePorLinea: [] })),
      );
  }

  getDetallePorLinea(codigoVendedor: string, codigoLinea: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoLinea}`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorLinea) {
            res.detallePorLinea = Array.isArray(res.detallePorLinea)
              ? res.detallePorLinea : [];
          }
          return res;
        }),
        catchError(() => of({ detallePorLinea: [] })),
      );
  }

  getDetallePorLineaProveedor(codigoVendedor: string, codigoProveedor: string, filtros?: DashboardFilters): Observable<any> {
    let params = this.buildParams(filtros);
    // Eliminar el parámetro 'proveedor' de los params si existe
    if (params.has('proveedor')) {
      params = params.delete('proveedor');
    }
    return this.http.get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/linea/${codigoProveedor}`, { params });
  }

  getCiudadesPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/ciudades`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorCiudad) {
            res.detallePorCiudad = Array.isArray(res.detallePorCiudad)
              ? res.detallePorCiudad : [];
          }
          return res;
        }),
        catchError(() => of({ detallePorCiudad: [] })),
      );
  }

  getProductosPorVendedor(codigoVendedor: string, filtros?: DashboardFilters): Observable<any> {
    const params = this.buildParams(filtros);
    return this.http
      .get<any>(`${this.apiUrl}/mes/cumplimiento/vendedor/${codigoVendedor}/productos`, { params })
      .pipe(
        map((res) => {
          if (res?.detallePorProducto) {
            res.data = Array.isArray(res.detallePorProducto)
              ? res.detallePorProducto : [];
          } else if (res?.data) {
            res.data = Array.isArray(res.data) ? res.data : [];
          } else {
            res = { ...res, data: [] };
          }
          return res;
        }),
        catchError(() => of({ data: [] })),
      );
  }


  /**
   * Obtiene la lista de proveedores con sus códigos
   * Backend devuelve: [{ id_proveedor, codigo, nombre, cuota, fecha_inicio, fecha_fin }, ...]
   */
  getProveedores(): Observable<any[]> {
    
    
    return this.http
      .get<any[]>(`${this.apiUrl}/proveedor`)
      .pipe(
        map((res) => {
          const proveedores = Array.isArray(res) ? res : [];
         
          if (proveedores.length > 0) {
            
          }
       
          return proveedores;
        }),
        catchError((err) => {
          console.error('❌ Error al obtener proveedores:', err);
          
          return of([]);
        })
      );
  }
}
