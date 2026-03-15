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

    this.authService
      .login({
        codigo,
        password,
      })
      .subscribe({
        next: (resp) => {
          this.is_error = false;
          this.errorMessage = 'Código o contraseña no válidos';
          this.is_loading = false;
          localStorage.setItem('vendedor', JSON.stringify(resp.vendedor));
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.is_error = true;
          this.errorMessage =
            error?.error?.message || 'Código o contraseña no válidos';
          this.is_loading = false;
        },
      });
  }
}