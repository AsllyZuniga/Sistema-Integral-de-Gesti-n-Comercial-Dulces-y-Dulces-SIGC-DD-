import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [FormsModule, CommonModule],
})
export class LoginComponent {
  is_error = false;
  is_loading = false;
  errorMessage = 'Código o contraseña no válidos';
  mostrarPassword = false;
  user = { codigo: '', password: '' };

  constructor(
    private router: Router,
    private authService: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {}

  validarUsuario(): void {
    if (this.is_loading) return;

    const codigo = this.user.codigo.trim();
    const password = this.user.password;

    if (!codigo || !password) {
      this.is_error = true;
      this.errorMessage = 'Debe ingresar código y contraseña';
      return;
    }

    this.is_loading = true;
    this.is_error = false;

    // Enviamos ambos campos para compatibilidad con backends que autentican por username o codigo.
    this.authService
      .login({ codigo, username: codigo, password })
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
            this.errorMessage =
              err?.name === 'TimeoutError'
                ? 'El servidor está tardando demasiado. Intente nuevamente.'
                : err?.status === 401
                  ? 'Código o contraseña no válidos'
                  : err?.error?.message || 'No se pudo iniciar sesión. Intente nuevamente.';
            this.cdr.detectChanges();
          });
            console.error('Login fallido:', err);
        },
      });
  }

  onCredentialInput(): void {
    if (this.is_error) {
      this.is_error = false;
      this.errorMessage = 'Código o contraseña no válidos';
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

    this.authService.iniciarTimerInactividad();
    this.router.navigate(['/dashboard']);
  }
}
