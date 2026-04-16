import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService, SessionUser } from './session.service';

const INACTIVIDAD_MS   = 60 * 60 * 1000;
const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
const VIGILANCIA_SESION_MS = 1500;
const VALIDACION_BACKEND_MS = 1500;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl  = `${environment.apiUrl}/api/auth`;
  private readonly sessionValidationUrls = [
    `${this.apiUrl}/validate`,
    `${this.apiUrl}/session/validate`,
    `${this.apiUrl}/me`,
    `${this.apiUrl}/profile`,
    `${environment.apiUrl}/auth/validate`,
    `${environment.apiUrl}/auth/session/validate`,
    `${environment.apiUrl}/auth/me`,
    `${environment.apiUrl}/auth/profile`,
    `${environment.apiUrl}/dashboard`,
  ];
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private watchdogId: ReturnType<typeof setInterval> | null = null;
  private backendValidacionDisponible = true;
  private backendValidacionEnCurso = false;
  private ultimaValidacionBackend = 0;
  private indiceValidacionBackend = 0;

  constructor(
    private http:    HttpClient,
    private router:  Router,
    private ngZone:  NgZone,
    private session: SessionService,
  ) {
    this.iniciarVigilanciaSesion();
    this.iniciarSincronizacionPestanas();
  }

  login(data: { codigo?: string; username?: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  getVendedor(): SessionUser | null {
    return this.session.getUser();
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
      EVENTOS_ACTIVIDAD.forEach(evento =>
        window.addEventListener(evento, this.onActividad, { passive: true })
      );
    });
  }

  detenerTimerInactividad(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    EVENTOS_ACTIVIDAD.forEach(evento =>
      window.removeEventListener(evento, this.onActividad)
    );
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

  private iniciarVigilanciaSesion(): void {
    if (this.watchdogId) {
      clearInterval(this.watchdogId);
      this.watchdogId = null;
    }

    this.ngZone.runOutsideAngular(() => {
      this.watchdogId = setInterval(() => {
        this.ngZone.run(() => this.validarSesionActiva());
      }, VIGILANCIA_SESION_MS);

      window.addEventListener('visibilitychange', this.onCambioVisibilidad, { passive: true });
    });
  }

  private onCambioVisibilidad = (): void => {
    if (document.visibilityState === 'visible') {
      this.validarSesionActiva();
    }
  };

  private esRutaPublica(url: string): boolean {
    const limpia = String(url ?? '')
      .split('?')[0]
      .split('#')[0]
      .trim();
    return limpia === '' || limpia === '/' || limpia === '/login';
  }

  private validarSesionActiva(): void {
    if (this.esRutaPublica(this.router.url)) return;
    if (!this.isLoggedIn()) {
      this.forzarReingreso(false);
      return;
    }

    this.validarSesionConBackend();
  }

  private validarSesionConBackend(): void {
    if (!this.backendValidacionDisponible || this.backendValidacionEnCurso) return;

    const ahora = Date.now();
    if (ahora - this.ultimaValidacionBackend < VALIDACION_BACKEND_MS) return;

    this.backendValidacionEnCurso = true;
    this.ultimaValidacionBackend = ahora;

    this.validarContraEndpoint(this.indiceValidacionBackend);
  }

  private validarContraEndpoint(indice: number): void {
    const endpoint = this.sessionValidationUrls[indice];

    if (!endpoint) {
      this.backendValidacionEnCurso = false;
      // No desactivar permanentemente: puede variar por entorno/backends.
      this.indiceValidacionBackend = 0;
      return;
    }

    this.http
      .get(endpoint, { observe: 'response' })
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.backendValidacionEnCurso = false;
          this.indiceValidacionBackend = indice;
        },
        error: (err) => {
          if (err?.status === 401) {
            this.backendValidacionEnCurso = false;
            this.indiceValidacionBackend = indice;
            this.forzarReingreso(true);
            return;
          }

          if (err?.status === 404 || err?.status === 405) {
            this.validarContraEndpoint(indice + 1);
            return;
          }

          if (err?.status === 403) {
            // Endpoint existe pero restringe permisos; se considera sesión vigente.
            this.backendValidacionEnCurso = false;
            this.indiceValidacionBackend = indice;
            return;
          }

          this.backendValidacionEnCurso = false;
        },
      });
  }

  forzarReingreso(broadcast = false): void {
    this.detenerTimerInactividad();
    this.session.clearUser(broadcast);

    if (!this.esRutaPublica(this.router.url)) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}