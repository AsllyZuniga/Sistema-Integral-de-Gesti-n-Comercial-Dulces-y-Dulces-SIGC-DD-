import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

const INACTIVIDAD_MS   = 20 * 60 * 1000;
const EVENTOS_ACTIVIDAD = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl  = 'http://localhost:3000/api/auth';
  private timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http:    HttpClient,
    private router:  Router,
    private ngZone:  NgZone,
  ) {}

  login(data: { codigo?: string; username?: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  getVendedor(): any {
    return JSON.parse(sessionStorage.getItem('vendedor') || 'null');
  }

  isLoggedIn(): boolean {
    return !!sessionStorage.getItem('vendedor');
  }

  guardarSesion(vendedor: any): void {
    sessionStorage.setItem('vendedor', JSON.stringify(vendedor));
  }

  logout(): void {
    this.detenerTimerInactividad();
    sessionStorage.removeItem('vendedor');
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