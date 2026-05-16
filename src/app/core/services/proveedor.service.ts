import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface ProveedorDB {
  id_proveedor: string;
  codigo: string;
  nombre: string;
  cuota?: any;
  fecha_inicio?: any;
  fecha_fin?: any;
}

interface ProveedorCategoriasResponse {
  success?: boolean;
  categorias?: Array<{
    id_categoria?: number | string;
    nombre?: string;
    cantidad_items?: number;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ProveedorService {
  private apiUrl = `${environment.apiUrl}/proveedor`;

  constructor(private http: HttpClient) {}

  // Obtener todos los proveedores de la BD
  getAllProveedores(): Observable<ProveedorDB[]> {
    return this.http.get<ProveedorDB[]>(this.apiUrl).pipe(
      map((res) => {
        return Array.isArray(res) ? res : [];
      }),
      catchError((err) => {
        console.error('❌ [ProveedorService] Error cargando proveedores:', err);
        return of([]);
      }),
    );
  }

  // Obtener categorias de un proveedor por codigo (ej: /proveedor/535/categorias)
  getCategoriasByCodigo(codigoProveedor: string): Observable<string[]> {
    const codigo = String(codigoProveedor ?? '').trim();
    if (!codigo) return of([]);

    const urlSingular = `${this.apiUrl}/${encodeURIComponent(codigo)}/categorias`;
    const urlPlural = `${this.apiUrl}/proveedores/${encodeURIComponent(codigo)}/categorias`;

    return this.http.get<ProveedorCategoriasResponse>(urlSingular).pipe(
      catchError(() => this.http.get<ProveedorCategoriasResponse>(urlPlural)),
      map((res) => {
        const categorias = Array.isArray(res?.categorias) ? res.categorias : [];
        return categorias
          .map((item) => String(item?.nombre ?? '').trim())
          .filter(Boolean);
      }),
      catchError((err) => {
        console.error('❌ [ProveedorService] Error cargando categorias por proveedor:', err);
        return of([]);
      }),
    );
  }
}
