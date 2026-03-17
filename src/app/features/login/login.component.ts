import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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

    this.authService.login({ codigo, password }).subscribe({
      next: (resp) => {
        console.log('✅ [LOGIN] Respuesta exitosa del backend:', resp);
        this.onLoginExitoso(resp);
      },
      error: (err) => {
        console.warn('⚠️ [LOGIN] Primer intento fallido, probando con username');
        this.authService.login({ username: codigo, password }).subscribe({
          next: (resp) => {
            console.log('✅ [LOGIN] Segundo intento exitoso:', resp);
            this.onLoginExitoso(resp);
          },
          error: (err) => {
            this.is_error = true;
            this.errorMessage = err?.error?.message || 'Código o contraseña no válidos';
            this.is_loading = false;
            console.error('❌ [LOGIN] Ambos intentos fallaron:', err);
          },
        });
      },
    });
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
