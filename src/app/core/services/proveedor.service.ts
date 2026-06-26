import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { map } from 'rxjs/operators';

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
  private apiUrl = '/api/proveedor';

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

  // Obtener categorias de un proveedor por codigo.
  // Se prueban rutas singular/plural para no depender de una sola forma del backend.
  getCategoriasByCodigo(codigoProveedor: string): Observable<string[]> {
    const codigo = String(codigoProveedor ?? '').trim();
    if (!codigo) return of([]);

    const codigoUrl = encodeURIComponent(codigo);
    const rutas = [
      `/api/proveedor/${codigoUrl}/categorias`,
      `/api/proveedores/${codigoUrl}/categorias`,
      `${this.apiUrl}/${codigoUrl}/categorias`,
    ];

    const normalizarRespuesta = (res: any): string[] => {
      const rawCategorias = Array.isArray(res)
        ? res
        : Array.isArray(res?.categorias)
          ? res.categorias
          : Array.isArray(res?.data)
            ? res.data
            : [];

      return rawCategorias
        .map((item: any) =>
          String(
            item?.nombre ??
              item?.categoria ??
              item?.nomCategoria ??
              item?.nombreCategoria ??
              item ??
              '',
          ).trim(),
        )
        .filter(Boolean);
    };

    const intentarRuta = (index: number): Observable<string[]> => {
      const ruta = rutas[index];
      if (!ruta) return of([]);

      return this.http.get<any>(ruta).pipe(
        map(normalizarRespuesta),
        catchError(() => intentarRuta(index + 1)),
      );
    };

    return intentarRuta(0).pipe(
      catchError((err) => {
        console.error('❌ [ProveedorService] Error cargando categorias por proveedor:', err);
        return of([]);
      }),
    );
  }
}
