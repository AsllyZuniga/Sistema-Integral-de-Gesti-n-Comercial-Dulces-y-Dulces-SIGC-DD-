import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  ) {}

  login(data: { codigo?: string; username?: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  getVendedor(): any {
    const vendedor = JSON.parse(sessionStorage.getItem('vendedor') || 'null');
    console.log('👤 getVendedor() - sessionStorage:', vendedor);
    return vendedor;
  }

  isLoggedIn(): boolean {
    const loggedIn = !!sessionStorage.getItem('vendedor');
    console.log('🔐 isLoggedIn():', loggedIn);
    return loggedIn;
  }

  guardarSesion(vendedor: any): void {
    console.log('💾 guardarSesion() - Guardando vendedor:', vendedor);
    const jsonVendedor = JSON.stringify(vendedor);
    sessionStorage.setItem('vendedor', jsonVendedor);
    
    // Verificar que se guardó
    const verificacion = sessionStorage.getItem('vendedor');
    console.log('✅ guardarSesion() - Verificación. Guardado en sessionStorage:', verificacion);
  }

  logout(): void {
    console.log('🚪 logout() - Eliminando sesión');
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