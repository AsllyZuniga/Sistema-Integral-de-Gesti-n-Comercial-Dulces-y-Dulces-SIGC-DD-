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

    console.log('🔐 [LOGIN] Iniciando login con código:', codigo);

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
          console.log('✅ [LOGIN] Respuesta exitosa del backend:', resp);
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
          console.error('❌ [LOGIN] Login fallido:', err);
        },
      });
  }

  onCredentialInput(): void {
    if (this.is_error) {
      this.is_error = false;
      this.errorMessage = 'Código o contraseña no válidos';
    }
  }

  private onLoginExitoso(resp: any): void {
    this.is_error = false;
    this.is_loading = false;

    console.log('📩 [LOGIN] Procesando respuesta exitosa');
    console.log('📩 [LOGIN] resp.vendedor:', resp.vendedor);
    console.log('📩 [LOGIN] resp.token:', resp.token);
    console.log('📩 [LOGIN] resp.jwt:', resp.jwt);

    const vendedor = {
      ...(resp.vendedor ?? {
        idVendedor: null,
        idUsuario: resp.usuario?.idUsuario ?? null,
        codVendedor: '',
        codigo: '',
        nombre: resp.usuario?.username ?? 'Usuario',
        username: resp.usuario?.username ?? '',
        estado: true,
        rol: resp.usuario?.rol ?? { idRol: resp.usuario?.idRol ?? 1, nombre: 'Admin' },
      }),
      jwt: resp.jwt || resp.token,
    };

    console.log('📦 [LOGIN] Objeto vendedor a guardar:', vendedor);
    console.log('🔑 [LOGIN] JWT extraído:', vendedor.jwt);

    this.authService.guardarSesion(vendedor);
    
    // Verificar que se guardó correctamente
    const sesionGuardada = JSON.parse(sessionStorage.getItem('vendedor') || '{}');
    console.log('✅ [LOGIN] Sesión guardada en sessionStorage:', sesionGuardada);
    console.log('✅ [LOGIN] JWT en sesión guardada:', sesionGuardada.jwt);

    this.authService.iniciarTimerInactividad();
    console.log('🎯 [LOGIN] Navegando a dashboard...');
    this.router.navigate(['/dashboard']);
  }
}
