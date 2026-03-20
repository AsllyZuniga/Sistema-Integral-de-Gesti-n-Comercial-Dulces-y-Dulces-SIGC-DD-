import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  isCollapsed  = false;
  isMobileOpen = false;
  rolId        = 0;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(private router: Router, private authService: AuthService) {
    // ✅ Lee desde sessionStorage via AuthService
    const usuario = this.authService.getVendedor();
    this.rolId = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);
  }

  get tituloRol(): string {
    if (this.rolId === 1) return 'Admin';
    if (this.rolId === 2) return 'Supervisor';
    return 'Vendedor';
  }

  private readonly todasLasOpciones = [
    { icon: 'dashboard',   label: 'Dashboard',       ruta: '/dashboard', roles: [1, 2, 3] },
    { icon: 'upload_file', label: 'Carga de Ventas', ruta: '/carga',     roles: [1, 2]    },
  ];

  get navItems() {
    return this.todasLasOpciones.filter(item => item.roles.includes(this.rolId));
  }

  isActive(ruta: string): boolean {
    return this.router.url === ruta;
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  toggleMobile(): void {
    this.isMobileOpen = !this.isMobileOpen;
  }

  closeMobile(): void {
    this.isMobileOpen = false;
  }

  navegar(ruta: string): void {
    this.closeMobile();
    this.router.navigate([ruta]);
  }
}