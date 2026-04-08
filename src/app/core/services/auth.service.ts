import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionService, SessionUser } from './session.service';

const INACTIVIDAD_MS   = 60 * 60 * 1000;
const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl  = `${environment.apiUrl}/api/auth`;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http:    HttpClient,
    private router:  Router,
    private ngZone:  NgZone,
    private session: SessionService,
  ) {}

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
    this.session.clearUser();
    this.router.navigate(['/login']);
  }

  iniciarTimerInactividad(): void {
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
    this.reiniciarTimer();
  };

  private reiniciarTimer(): void {
    if (this.timerId) clearTimeout(this.timerId);
    this.timerId = setTimeout(() => {
      this.ngZone.run(() => this.logout());
    }, INACTIVIDAD_MS);
  }
}