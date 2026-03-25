import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UsuariosService {
  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) { }

  /**
   * GET /usuario
   * Obtiene lista de usuarios (supervisores y vendedores)
   */
  listarUsuarios(): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/usuario`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  /**
   * GET /usuario
   * Obtiene lista de supervisores (rolId = 2)
   */
  listarSupervisores(): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/usuario`)
      .pipe(
        map((res) => {
          const usuarios = Array.isArray(res) ? res : res?.data ?? [];
          // Filtrar solo supervisores (id_rol = 2)
          return usuarios.filter((u: any) => {
            const rol = u?.id_rol ?? u?.rol?.idRol ?? u?.idRol ?? u?.rolId ?? 0;
            console.log('🔍 Filtrando usuario:', u?.username, 'rol:', rol);
            return Number(rol) === 2;
          });
        }),
        catchError(() => of([])),
      );
  }

  /**
   * GET /usuario
   * Obtiene lista de vendedores
   */
  listarVendedores(): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/usuario`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  /**
   * GET /vendedores
   * Obtiene detalle de vendedores con código y nombre
   */
  listarDetalleVendedores(): Observable<any[]> {
    return this.http
      .get<any>(`${this.apiUrl}/vendedores`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : res?.data ?? [])),
        catchError(() => of([])),
      );
  }

  /**
   * GET /vendedor/supervisor/{id}
   * Obtiene vendedores asignados a un supervisor
   */
  obtenerVendedoresDelSupervisor(idSupervisor: string): Observable<any[]> {
    const url = `${this.apiUrl}/vendedor/supervisor/${idSupervisor}`;
    console.log('🔗 [UsuariosService] Llamando a:', url);
    return this.http
      .get<any[]>(url)
      .pipe(
        map((res) => {
          const vendedores = Array.isArray(res) ? res : [];
          console.log('📥 [UsuariosService] Respuesta:', vendedores.length, 'vendedores');
          return vendedores;
        }),
        catchError((err) => {
          console.error('❌ [UsuariosService] Error cargando vendedores del supervisor:', err);
          return of([]);
        }),
      );
  }

  /**
   * PUT /usuario/{id}
   * Actualiza un usuario
   */
  actualizarUsuario(idUsuario: string | number, datos: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/usuario/${idUsuario}`,
      datos,
    ).pipe(
      catchError((err) => {
        console.error('❌ Error actualizando usuario:', err);
        throw err;
      }),
    );
  }

  /**
   * PUT /usuario/{id}
   * Desactiva un usuario (cambia estado a false)
   */
  desactivarUsuario(idUsuario: string | number): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/usuario/${idUsuario}`,
      { estado: false },
    ).pipe(
      catchError((err) => {
        console.error('❌ Error desactivando usuario:', err);
        throw err;
      }),
    );
  }

  /**
   * POST /usuario
   * Crea un nuevo usuario
   */
  crearUsuario(datos: { username: string; password: string; id_rol: number; estado?: boolean }): Observable<any> {
    const payload = {
      username: datos.username,
      password: datos.password,
      id_rol: datos.id_rol,
      estado: datos.estado !== false, // Por defecto true
    };

    return this.http.post<any>(`${this.apiUrl}/usuario`, payload).pipe(
      catchError((err) => {
        console.error('❌ Error creando usuario:', err);
        throw err;
      }),
    );
  }

  /**
   * POST /vendedor
   * Crea un nuevo vendedor
   */
  crearVendedor(datos: {
    codigo_vendedor: string;
    nombre: string;
    id_usuario: number;
    id_cuotaMes?: number;
    id_cuotaSemana?: number;
    id_cuotaDia?: number;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/vendedor`, datos).pipe(
      catchError((err) => {
        console.error('❌ Error creando vendedor:', err);
        throw err;
      }),
    );
  }

  /**
   * PUT /vendedor/{id}
   * Actualiza un vendedor
   */
  actualizarVendedor(idVendedor: string | number, datos: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/vendedor/${idVendedor}`,
      datos,
    ).pipe(
      catchError((err) => {
        console.error('❌ Error actualizando vendedor:', err);
        throw err;
      }),
    );
  }

  /**
   * PUT /vendedor/{id}/asignar-supervisor
   * Asigna un supervisor a un vendedor
   */
  asignarSupervisor(idVendedor: string, idSupervisor: string): Observable<any> {
    const supervisorId = Number(idSupervisor);
    return this.http.put<any>(`${this.apiUrl}/vendedor/${idVendedor}/asignar-supervisor`, {
      idSupervisor: supervisorId,
      id_supervisor: supervisorId,
    });
  }
}
