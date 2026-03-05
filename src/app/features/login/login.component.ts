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
  user = { codigo: '' };

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  validarUsuario() {
    this.authService.login(this.user).subscribe({
      next: (resp) => {
        this.is_error = false;
        localStorage.setItem('vendedor', JSON.stringify(resp.vendedor));
        this.router.navigate(['/dashboard']);
      },
      error: () => (this.is_error = true),
    });
  }
}