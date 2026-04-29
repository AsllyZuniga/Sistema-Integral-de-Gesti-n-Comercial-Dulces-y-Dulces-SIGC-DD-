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
}
