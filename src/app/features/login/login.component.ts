import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [FormsModule, CommonModule, NgOptimizedImage],
})
export class LoginComponent implements OnInit {
  private static readonly LOCK_KEY = 'auth_login_lock_until';
  private static readonly ATTEMPTS_KEY = 'auth_login_failed_attempts';
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCK_MS = 60_000;

  is_error = false;
  is_loading = false;
  errorMessage = 'Código, nombre de usuario o contraseña no válidos';
  mostrarPassword = false;
  user = { codigo: '', password: '' };
  private intentosFallidos = 0;
  private bloqueadoHasta = 0;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.intentosFallidos = Number(sessionStorage.getItem(LoginComponent.ATTEMPTS_KEY) ?? '0') || 0;
    this.bloqueadoHasta = Number(sessionStorage.getItem(LoginComponent.LOCK_KEY) ?? '0') || 0;
  }

  private get estaBloqueado(): boolean {
    return Date.now() < this.bloqueadoHasta;
  }

  private persistirControlIntentos(): void {
    sessionStorage.setItem(LoginComponent.ATTEMPTS_KEY, String(this.intentosFallidos));
    sessionStorage.setItem(LoginComponent.LOCK_KEY, String(this.bloqueadoHasta));
  }

  private resetearControlIntentos(): void {
    this.intentosFallidos = 0;
    this.bloqueadoHasta = 0;
    sessionStorage.removeItem(LoginComponent.ATTEMPTS_KEY);
    sessionStorage.removeItem(LoginComponent.LOCK_KEY);
  }

  private registrarFalloLogin(): void {
    this.intentosFallidos += 1;

    if (this.intentosFallidos >= LoginComponent.MAX_ATTEMPTS) {
      this.bloqueadoHasta = Date.now() + LoginComponent.LOCK_MS;
      this.errorMessage = 'Demasiados intentos fallidos. Intenta nuevamente en 1 minuto.';
    } else {
      this.errorMessage = 'Credenciales inválidas. Verifica e intenta nuevamente.';
    }

    this.persistirControlIntentos();
  }

  private returnUrlSeguro(raw: string): string {
    const value = String(raw ?? '').trim();
    if (!value.startsWith('/')) return '/dashboard';
    if (value.startsWith('//')) return '/dashboard';
    if (value.includes('://')) return '/dashboard';
    if (value.startsWith('/login')) return '/dashboard';
    return value;
  }

  validarUsuario(): void {
    if (this.is_loading) return;

    if (this.estaBloqueado) {
      this.is_error = true;
      this.errorMessage = 'Demasiados intentos fallidos. Intenta nuevamente en 1 minuto.';
      return;
    }

    const identificador = this.user.codigo.trim();
    const password = this.user.password;

    if (!identificador || !password) {
      this.is_error = true;
      this.errorMessage = 'Debe ingresar credenciales válidas.';
      return;
    }

    if (!/^[a-zA-ZÀ-ÿ0-9._\-\s]{3,60}$/.test(identificador)) {
      this.is_error = true;
      this.errorMessage = 'Formato de usuario no válido.';
      return;
    }

    if (password.length < 4 || password.length > 128) {
      this.is_error = true;
      this.errorMessage = 'Formato de contraseña no válido.';
      return;
    }

    this.is_loading = true;
    this.is_error = false;

    this.authService
      .login({ codigo: identificador, username: identificador, nombre: identificador, password })
      .pipe(
        timeout(10000),
        finalize(() => {
          this.is_loading = false;
        }),
      )
      .subscribe({
        next: (resp) => {
          this.onLoginExitoso(resp);
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.is_loading = false;
            this.is_error = true;
            this.registrarFalloLogin();
            if (err?.name === 'TimeoutError') {
              this.errorMessage = 'No fue posible validar tu sesión en este momento. Intenta nuevamente.';
            }
            this.cdr.detectChanges();
          });
        },
      });
  }

  onCredentialInput(): void {
    if (this.is_error) {
      this.is_error = false;
      this.errorMessage = 'Código, nombre de usuario o contraseña no válidos';
    }
  }

  togglePasswordVisibility(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  private obtenerCodigoSesion(resp: any): string {
    return String(
      resp?.vendedor?.codVendedor ??
        resp?.vendedor?.codigo_vendedor ??
        resp?.vendedor?.codigo ??
        resp?.usuario?.codVendedor ??
        resp?.usuario?.codigo_vendedor ??
        resp?.usuario?.codigo ??
        resp?.codVendedor ??
        resp?.codigo_vendedor ??
        resp?.codigo ??
        '',
    ).trim();
  }

  private obtenerRolSesion(resp: any): any {
    return resp?.vendedor?.rol ?? resp?.usuario?.rol ?? { idRol: resp?.usuario?.idRol ?? 1, nombre: 'Admin' };
  }

  private onLoginExitoso(resp: any): void {
    this.is_error = false;
    this.is_loading = false;

    const codigoSesion = this.obtenerCodigoSesion(resp);
    const rolSesion = this.obtenerRolSesion(resp);

    const vendedor = {
      ...(resp.vendedor ?? {
        idVendedor: null,
        idUsuario: resp.usuario?.idUsuario ?? null,
        codVendedor: codigoSesion,
        codigo: codigoSesion,
        codigo_vendedor: codigoSesion,
        nombre: resp.usuario?.username ?? 'Usuario',
        username: resp.usuario?.username ?? '',
        estado: true,
        rol: rolSesion,
      }),
      idUsuario: resp.usuario?.idUsuario ?? resp.vendedor?.idUsuario ?? null,
      id_usuario: resp.usuario?.idUsuario ?? resp.vendedor?.id_usuario ?? null,
      idVendedor: resp.vendedor?.idVendedor ?? resp.usuario?.idVendedor ?? null,
      id_vendedor: resp.vendedor?.id_vendedor ?? resp.usuario?.id_vendedor ?? null,
      codVendedor: codigoSesion,
      codigo: codigoSesion,
      codigo_vendedor: codigoSesion,
      rol: rolSesion,
      jwt: resp.jwt || resp.token,
    };

    this.authService.guardarSesion(vendedor);
    this.resetearControlIntentos();

    this.authService.iniciarTimerInactividad();
    const returnUrl = this.returnUrlSeguro(this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard');
    this.router.navigateByUrl(returnUrl || '/dashboard', { replaceUrl: true });
  }
}