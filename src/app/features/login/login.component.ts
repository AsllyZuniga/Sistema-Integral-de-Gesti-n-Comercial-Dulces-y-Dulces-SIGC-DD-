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

  validarUsuario() {
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

    // ✅ Intenta primero con codigo (vendedores), si falla intenta con username (admins/supervisores)
    this.authService.login({ codigo, password }).subscribe({
      next: (resp) => this.onLoginExitoso(resp),
      error: () => {
        // ✅ Reintenta con username para usuarios sin vendedor asociado
        this.authService.login({ username: codigo, password }).subscribe({
          next: (resp) => this.onLoginExitoso(resp),
          error: (error) => {
            this.is_error = true;
            this.errorMessage = error?.error?.message || 'Código o contraseña no válidos';
            this.is_loading = false;
          }
        });
      }
    });
  }

  private onLoginExitoso(resp: any) {
    this.is_error = false;
    this.is_loading = false;

    // ✅ Si no viene vendedor (admin sin vendedor asociado), construye uno mínimo
    const vendedor = resp.vendedor ?? {
      idVendedor: null,
      idUsuario: resp.usuario?.idUsuario ?? null,
      codVendedor: '',
      codigo: '',
      nombre: resp.usuario?.username ?? 'Usuario',
      username: resp.usuario?.username ?? '',
      estado: true,
      rol: resp.usuario?.rol ?? { idRol: resp.usuario?.idRol ?? 1, nombre: 'Admin' }
    };

    localStorage.setItem('vendedor', JSON.stringify(vendedor));
    this.router.navigate(['/dashboard']);
  }
}