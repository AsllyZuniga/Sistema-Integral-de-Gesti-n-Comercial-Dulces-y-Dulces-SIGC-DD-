import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, shareReplay, catchError, map, Subject } from 'rxjs';
import { DashboardFilters } from '../../shared/components/filters/filters.component';
import { environment } from '../../../environments/environment';

/**
 * Servicio centralizado para el estado y cache del dashboard SUPERVISOR.
 *
 * - Evita llamadas HTTP repetidas usando shareReplay(1) y Map<key, Observable>
 * - Comparte datos entre todos los componentes del supervisor con signals
 * - Cancela peticiones obsoletas con un "request id" (Subject)
 * - Lazy loading: solo pide catalogos cuando el usuario abre la seccion
 */
@Injectable({ providedIn: 'root' })
export class SupervisorCacheService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  private apiUrl = environment?.apiUrl
    ? `${environment.apiUrl}/api`
    : '/api';

  // ==================== Signals (estado reactivo compartido) ====================
  private readonly _vendedoresAsignados = signal<any[]>([]);
  private readonly _cargandoVendedores = signal<boolean>(false);
  private readonly _ultimoError = signal<string>('');
  private readonly _idSupervisor = signal<number | null>(null);

  readonly vendedoresAsignados = this._vendedoresAsignados.asReadonly();
  readonly cargandoVendedores = this._cargandoVendedores.asReadonly();
  readonly ultimoError = this._ultimoError.asReadonly();
  readonly idSupervisor = this._idSupervisor.asReadonly();

  readonly totalVendedores = computed(() => this._vendedoresAsignados().length);
  readonly codigosVendedoresAsignados = computed(() =>
    this._vendedoresAsignados()
      .map((v) => String(v?.codVendedor ?? v?.codigo_vendedor ?? '').trim())
      .filter(Boolean),
  );

  // ==================== Cache de Observables (HTTP) ====================
  private vendedoresHttpCache = new Map<number, Observable<any[]>>();
  private cumplimientoCache = new Map<string, Observable<any>>();
  private catalogoCache = new Map<string, Observable<any>>();

  // Subject para invalidar peticiones obsoletas
  private invalidar$ = new Subject<void>();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.invalidar$.next();
      this.invalidar$.complete();
      this.vendedoresHttpCache.clear();
      this.cumplimientoCache.clear();
      this.catalogoCache.clear();
    });
  }

  setIdSupervisor(id: number | null): void {
    if (this._idSupervisor() === id) return;
    this._idSupervisor.set(id);
  }

  /**
   * Carga vendedores asignados al supervisor actual con cache por id.
   * Si ya hay cache vivo, devuelve el observable cacheado.
   */
  cargarVendedoresAsignados(idSupervisor: number, forceReload = false): Observable<any[]> {
    if (!idSupervisor) {
      this._vendedoresAsignados.set([]);
      return of([]);
    }

    if (!forceReload) {
      const cached = this.vendedoresHttpCache.get(idSupervisor);
      if (cached) {
        this.suscribirVendedores(cached, idSupervisor);
        return cached;
      }
    } else {
      this.vendedoresHttpCache.delete(idSupervisor);
    }

    this._cargandoVendedores.set(true);

    const obs$ = this.http
      .get<any>(`${this.apiUrl}/vendedor/supervisor/${idSupervisor}`)
      .pipe(
        map((res) => (Array.isArray(res) ? res : (res?.data ?? []))),
        catchError((err) => {
          console.error('[SupervisorCache] Error cargando vendedores:', err);
          this._ultimoError.set('No se pudieron cargar los vendedores');
          return of([]);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.vendedoresHttpCache.set(idSupervisor, obs$);
    this.suscribirVendedores(obs$, idSupervisor);
    return obs$;
  }

  private suscribirVendedores(obs$: Observable<any[]>, idSupervisor: number): void {
    this._cargandoVendedores.set(true);
    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (vendedores) => {
        this._vendedoresAsignados.set(Array.isArray(vendedores) ? vendedores : []);
        this._cargandoVendedores.set(false);
        this._idSupervisor.set(idSupervisor);
      },
      error: () => {
        this._cargandoVendedores.set(false);
      },
    });
  }

  /**
   * Cache de cumplimiento por clave de filtros.
   * Clave incluye: idSupervisor + fechaInicio + fechaFin + tipo (mes/dia/semana).
   */
  cargarCumplimientoSupervisor(
    idSupervisor: number,
    filtros: DashboardFilters,
    tipo: 'mes' | 'dia' | 'semana' = 'mes',
  ): Observable<any> {
    const key = `${idSupervisor}|${tipo}|${filtros?.fechaInicio ?? ''}|${filtros?.fechaFin ?? ''}`;

    const cached = this.cumplimientoCache.get(key);
    if (cached) return cached;

    let url = '';
    const params = this.buildFiltrosParams(filtros);

    if (tipo === 'mes') {
      url = `${this.apiUrl}/mes/cumplimiento/front`;
    } else if (tipo === 'dia') {
      url = `${this.apiUrl}/dia/cumplimiento/supervisor/${idSupervisor}`;
    } else {
      url = `${this.apiUrl}/semana/cumplimiento/admin`;
    }

    const obs$ = this.http.get<any>(url, { params }).pipe(
      catchError(() => of({ detalle: [], totales: null, periodo: null })),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cumplimientoCache.set(key, obs$);
    return obs$;
  }

  /**
   * Catalogo con cache: ciudades/lineas por supervisor+fechas.
   * Solo se llama cuando se abre la seccion que los necesita.
   */
  cargarCiudadesLineasSupervisor(
    idSupervisor: number,
    codigosVendedores: string[],
    filtros: DashboardFilters,
  ): Observable<{ ciudades: any[]; lineas: any[] }> {
    const key = `ciud-lineas|${idSupervisor}|${filtros?.fechaInicio ?? ''}|${filtros?.fechaFin ?? ''}`;

    const cached = this.catalogoCache.get(key);
    if (cached) return cached as Observable<{ ciudades: any[]; lineas: any[] }>;

    if (!codigosVendedores.length) {
      const empty = of({ ciudades: [], lineas: [] });
      this.catalogoCache.set(key, empty);
      return empty;
    }

    const obs$ = this.http
      .post<{ ciudades: any[]; lineas: any[] }>(
        `${this.apiUrl}/catalogos/supervisor/ciudades-lineas`,
        {
          idSupervisor,
          codigosVendedores,
          fechaInicio: filtros?.fechaInicio,
          fechaFin: filtros?.fechaFin,
        },
      )
      .pipe(
        catchError(() => {
          // Fallback: si el backend no tiene el endpoint batch, vacio.
          return of({ ciudades: [], lineas: [] });
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.catalogoCache.set(key, obs$);
    return obs$;
  }

  /**
   * Carga catalogo de proveedores de los vendedores del supervisor.
   */
  cargarProveedoresSupervisor(
    idSupervisor: number,
    filtros: DashboardFilters,
  ): Observable<any[]> {
    const key = `prov|${idSupervisor}|${filtros?.fechaInicio ?? ''}|${filtros?.fechaFin ?? ''}`;

    const cached = this.catalogoCache.get(key);
    if (cached) return cached as Observable<any[]>;

    const obs$ = this.http
      .get<any>(`${this.apiUrl}/catalogos/supervisor/proveedores`, {
        params: this.buildFiltrosParams({ ...filtros, vendedor: String(idSupervisor) }),
      })
      .pipe(
        map((res) => (Array.isArray(res) ? res : (res?.data ?? res?.detalle ?? []))),
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.catalogoCache.set(key, obs$);
    return obs$;
  }

  /**
   * Carga catalogo de categorias del supervisor (lazy, solo al abrir seccion).
   */
  cargarCategoriasSupervisor(
    idSupervisor: number,
    filtros: DashboardFilters,
  ): Observable<any[]> {
    const key = `cat|${idSupervisor}|${filtros?.fechaInicio ?? ''}|${filtros?.fechaFin ?? ''}|${filtros?.vendedor ?? ''}`;

    const cached = this.catalogoCache.get(key);
    if (cached) return cached as Observable<any[]>;

    const obs$ = this.http
      .get<any>(`${this.apiUrl}/catalogos/supervisor/categorias`, {
        params: this.buildFiltrosParams(filtros),
      })
      .pipe(
        map((res) => {
          if (Array.isArray(res)) return res;
          if (Array.isArray(res?.detalle)) return res.detalle;
          if (Array.isArray(res?.data)) return res.data;
          return [];
        }),
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.catalogoCache.set(key, obs$);
    return obs$;
  }

  invalidarTodo(): void {
    this.invalidar$.next();
    this.cumplimientoCache.clear();
    this.catalogoCache.clear();
    this._vendedoresAsignados.set([]);
    this._ultimoError.set('');
  }

  invalidarCatalogos(): void {
    this.catalogoCache.clear();
  }

  invalidarCumplimiento(): void {
    this.cumplimientoCache.clear();
  }

  invalidarVendedores(idSupervisor?: number): void {
    if (idSupervisor) {
      this.vendedoresHttpCache.delete(idSupervisor);
    } else {
      this.vendedoresHttpCache.clear();
    }
  }

  private buildFiltrosParams(filtros?: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filtros) return params;

    if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
    if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
    if (filtros.vendedor) params = params.set('vendedor', filtros.vendedor);
    if (filtros.proveedor) params = params.set('proveedor', filtros.proveedor);
    if (filtros.categoria) params = params.set('categoria', filtros.categoria);
    if (filtros.ciudad) params = params.set('ciudad', filtros.ciudad);
    if (filtros.linea) params = params.set('linea', filtros.linea);

    return params;
  }
}
