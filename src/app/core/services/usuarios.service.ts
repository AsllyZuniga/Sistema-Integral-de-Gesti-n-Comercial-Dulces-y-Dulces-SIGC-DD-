import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, catchError, map, of, shareReplay, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UsuariosService {
  private apiUrl = '/api';
  private supervisorAsignado$ = new Subject<{
    idVendedor: string;
    idSupervisor: string;
  }>();
  private vendedoresPorSupervisorCache = new Map<string, Observable<any[]>>();

  constructor(private http: HttpClient) {}

  /**
   * Observable que emite cuando se asigna un supervisor a un vendedor
   */
  onSupervisorAsignado() {
    return this.supervisorAsignado$.asObservable();
  }

  /**
   * GET /usuario
   * Obtiene lista de usuarios (supervisores y vendedores)
   */
  listarUsuarios(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/usuario`).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.data ?? []))),
      catchError(() => of([])),
    );
  }

  /**
   * GET /usuario
   * Obtiene lista de supervisores (rolId = 2)
   */
  listarSupervisores(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/usuario`).pipe(
      map((res) => {
        const usuarios = Array.isArray(res) ? res : (res?.data ?? []);
        // Filtrar solo supervisores (id_rol = 2)
        return usuarios.filter((u: any) => {
          const rol = u?.id_rol ?? u?.rol?.idRol ?? u?.idRol ?? u?.rolId ?? 0;
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
    return this.http.get<any>(`${this.apiUrl}/usuario`).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.data ?? []))),
      catchError(() => of([])),
    );
  }

  /**
   * GET /usuario
   * Obtiene lista de administradores (id_rol = 1)
   */
  listarAdministradores(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/usuario`).pipe(
      map((res) => {
        const usuarios = Array.isArray(res) ? res : (res?.data ?? []);
        return usuarios.filter((u: any) => {
          const rol = u?.id_rol ?? u?.rol?.idRol ?? u?.idRol ?? u?.rolId ?? 0;
          return Number(rol) === 1;
        });
      }),
      catchError(() => of([])),
    );
  }

  /**
   * GET /vendedor
   * Obtiene detalle de vendedores con código y nombre
   */
  listarDetalleVendedores(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/vendedor`).pipe(
      map((res) => (Array.isArray(res) ? res : (res?.data ?? []))),
      catchError(() => of([])),
    );
  }

  /**
   * GET /vendedor/supervisor/{id}
   * Obtiene vendedores asignados a un supervisor.
   * Usa cache por idSupervisor con shareReplay(1) para evitar
   * multiples llamadas HTTP cuando varios componentes la solicitan
   * con los mismos parametros en el mismo ciclo.
   */
  obtenerVendedoresDelSupervisor(idSupervisor: string): Observable<any[]> {
    const idNormalizado = String(idSupervisor ?? '').trim();
    if (!idNormalizado) return of([]);

    const cacheado = this.vendedoresPorSupervisorCache.get(idNormalizado);
    if (cacheado) return cacheado;

    const url = `${this.apiUrl}/vendedor/supervisor/${idNormalizado}`;

    const obs$ = this.http.get<any>(url).pipe(
      map((res) => {
        const vendedores = Array.isArray(res) ? res : (res?.data ?? []);
        return vendedores;
      }),
      catchError((err) => {
        console.error(
          `❌ [UsuariosService] Error cargando vendedores del supervisor ${idNormalizado}:`,
          err,
        );
        this.vendedoresPorSupervisorCache.delete(idNormalizado);
        return of([]);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.vendedoresPorSupervisorCache.set(idNormalizado, obs$);
    return obs$;
  }

  /**
   * Invalida el cache de vendedores del supervisor.
   * Llamar despues de asignar / desasignar supervisores.
   */
  invalidarCacheVendedoresPorSupervisor(idSupervisor?: string): void {
    if (idSupervisor) {
      this.vendedoresPorSupervisorCache.delete(String(idSupervisor));
    } else {
      this.vendedoresPorSupervisorCache.clear();
    }
  }

  /**
   * PUT /usuario/{id}
   * Actualiza un usuario
   */
  actualizarUsuario(idUsuario: string | number, datos: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/usuario/${idUsuario}`, datos).pipe(
      catchError((err) => {
        console.error('❌ Error actualizando usuario:', err);
        return throwError(() => err);
      }),
    );
  }

  /**
   * PUT /usuario/{id}
   * Desactiva un usuario (cambia estado a false)
   */
  desactivarUsuario(idUsuario: string | number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/usuario/${idUsuario}`, { estado: false }).pipe(
      catchError((err) => {
        console.error('❌ Error desactivando usuario:', err);
        return throwError(() => err);
      }),
    );
  }

  /**
   * POST /usuario
   * Crea un nuevo usuario
   */
  crearUsuario(datos: {
    username: string;
    password: string;
    id_rol: number;
    estado?: boolean;
  }): Observable<any> {
    const payload = {
      username: datos.username,
      password: datos.password,
      id_rol: datos.id_rol,
      estado: datos.estado !== false, // Por defecto true
    };

    return this.http.post<any>(`${this.apiUrl}/usuario`, payload).pipe(
      catchError((err) => {
        console.error('❌ Error creando usuario:', err);
        return throwError(() => err);
      }),
    );
  }

  /**
   * POST /auth/register
   * Crea un nuevo administrador
   */
  registrarAdministrador(datos: { username: string; password: string }): Observable<any> {
    const payload = {
      username: datos.username,
      password: datos.password,
      id_rol: 1,
      estado: true,
    };

    return this.http.post<any>(`${this.apiUrl}/auth/register`, payload).pipe(
      catchError((err) => {
        console.error('❌ Error creando administrador:', err);
        return throwError(() => err);
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
        return throwError(() => err);
      }),
    );
  }

  /**
   * PUT /vendedor/{id}
   * Actualiza un vendedor
   */
  actualizarVendedor(idVendedor: string | number, datos: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/vendedor/${idVendedor}`, datos).pipe(
      catchError((err) => {
        console.error('❌ Error actualizando vendedor:', err);
        return throwError(() => err);
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
    }).pipe(
      map((response) => {
        // Emitir evento de cambio
        this.supervisorAsignado$.next({
          idVendedor,
          idSupervisor,
        });
        return response;
      }),
      catchError((err) => {
        console.error('❌ Error asignando supervisor:', err);
        return throwError(() => err);
      }),
    );
  }
}
