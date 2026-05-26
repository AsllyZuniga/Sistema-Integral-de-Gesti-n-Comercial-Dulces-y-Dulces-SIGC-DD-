import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, take, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService, SessionUser } from './session.service';

const INACTIVIDAD_MS = 60 * 60 * 1000;
const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
const VALIDACION_SESION_TTL_MS = 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/api/auth`;
  private readonly sessionValidationUrl = `${environment.apiUrl}${environment.authValidationPath}`;

  private timerId: ReturnType<typeof setTimeout> | null = null;
  private validacionBackendHabilitada = true;
  private ultimaValidacionExitosa = 0;
  private validacionSesionInFlight$: Observable<boolean> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private session: SessionService,
  ) {
    this.iniciarSincronizacionPestanas();
  }

  private debugLog(contexto: string, detalle: string): void {
    if (!environment.production) {
      console.debug(`[${contexto}] ${detalle}`);
    }
  }

  login(data: {
    codigo?: string;
    username?: string;
    nombre?: string;
    password: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  getVendedor(): SessionUser | null {
    return this.session.getUser();
  }

  getToken(): string | null {
    return this.session.getToken();
  }

  isLoggedIn(): boolean {
    return this.session.isAuthenticated();
  }

  guardarSesion(vendedor: SessionUser): void {
    this.session.saveUser(vendedor);
  }

  logout(): void {
    this.detenerTimerInactividad();
    this.session.clearUser(true);
    this.ultimaValidacionExitosa = 0;
    this.validacionSesionInFlight$ = null;
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  iniciarTimerInactividad(): void {
    if (!this.isLoggedIn()) {
      this.forzarReingreso();
      return;
    }

    this.detenerTimerInactividad();
    this.reiniciarTimer();

    this.ngZone.runOutsideAngular(() => {
      EVENTOS_ACTIVIDAD.forEach((evento) =>
        window.addEventListener(evento, this.onActividad, { passive: true }),
      );
    });
  }

  detenerTimerInactividad(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, this.onActividad));
  }

  private onActividad = (): void => {
    if (!this.isLoggedIn()) {
      this.ngZone.run(() => this.forzarReingreso());
      return;
    }

    this.reiniciarTimer();
  };

  private reiniciarTimer(): void {
    if (this.timerId) clearTimeout(this.timerId);

    this.timerId = setTimeout(() => {
      this.ngZone.run(() => this.forzarReingreso(true));
    }, INACTIVIDAD_MS);
  }

  private iniciarSincronizacionPestanas(): void {
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('storage', this.onStorageAuthEvent);
    });
  }

  private onStorageAuthEvent = (event: StorageEvent): void => {
    if (event.key !== this.session.getAuthEventKey()) return;

    const authEvent = this.session.leerEventoAuth(event.newValue);
    if (!authEvent) return;

    const nonceLocal = this.session.getNonceSesion();
    if (!nonceLocal) return;

    if (authEvent.tipo === 'login' && authEvent.nonce && authEvent.nonce !== nonceLocal) {
      this.ngZone.run(() => this.forzarReingreso(false));
      return;
    }

    if (authEvent.tipo === 'logout' && authEvent.nonce && authEvent.nonce === nonceLocal) {
      this.ngZone.run(() => this.forzarReingreso(false));
    }
  };

  private esRutaPublica(url: string): boolean {
    const limpia = String(url ?? '')
      .split('?')[0]
      .split('#')[0]
      .trim();

    return limpia === '' || limpia === '/' || limpia === '/login';
  }

  validarSesionBackendUnaVez(force = false): Observable<boolean> {
    if (!this.isLoggedIn()) {
      return of(false);
    }

    if (!this.validacionBackendHabilitada) {
      return of(true);
    }

    const ahora = Date.now();

    if (!force && ahora - this.ultimaValidacionExitosa < VALIDACION_SESION_TTL_MS) {
      return of(true);
    }

    if (this.validacionSesionInFlight$) {
      return this.validacionSesionInFlight$;
    }

    this.debugLog('AuthService.validarSesion', `GET ${this.sessionValidationUrl}`);

    this.validacionSesionInFlight$ = this.http
      .get(this.sessionValidationUrl, { observe: 'response' })
      .pipe(
        take(1),
        map(() => true),
        tap(() => {
          this.ultimaValidacionExitosa = Date.now();
          this.debugLog('AuthService.validarSesion', 'Sesión válida');
        }),
        catchError((err) => {
          const status = Number(err?.status ?? 0);

          if (status === 401 || status === 403) {
            this.debugLog(
              'AuthService.validarSesion',
              `Sesión inválida (${status}). Token ausente, vencido o rechazado.`,
            );
            return of(false);
          }

          if (status === 404 || status === 405) {
            this.validacionBackendHabilitada = false;
            this.debugLog(
              'AuthService.validarSesion',
              `Endpoint no encontrado (${status}), se desactiva validación backend`,
            );
            return of(true);
          }

          this.debugLog(
            'AuthService.validarSesion',
            `Error no bloqueante validando sesión (${status || 'N/A'}). No se cierra sesión.`,
          );

          return of(true);
        }),
        finalize(() => {
          this.validacionSesionInFlight$ = null;
        }),
        shareReplay(1),
      );

    return this.validacionSesionInFlight$;
  }

  forzarReingreso(broadcast = false): void {
    this.detenerTimerInactividad();
    this.session.clearUser(broadcast);
    this.ultimaValidacionExitosa = 0;
    this.validacionSesionInFlight$ = null;

    if (!this.esRutaPublica(this.router.url)) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}