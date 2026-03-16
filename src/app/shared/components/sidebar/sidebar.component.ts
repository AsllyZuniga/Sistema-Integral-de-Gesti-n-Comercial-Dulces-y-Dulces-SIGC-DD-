import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

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
  rolId: number = 0;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(private router: Router) {
    try {
      const raw    = localStorage.getItem('vendedor') ?? '{}';
      const usuario = JSON.parse(raw);
      this.rolId   = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);
    } catch {
      this.rolId = 0;
    }
  }

  // Título del sidebar según rol
  get tituloRol(): string {
    if (this.rolId === 1) return 'Administrador';
    if (this.rolId === 2) return 'Supervisor';
    return 'Vendedor';
  }

  private readonly todasLasOpciones = [
    { icon: 'dashboard',         label: 'Dashboard',       ruta: '/dashboard',    roles: [1, 2, 3] },
    { icon: 'upload_file',       label: 'Carga de Ventas', ruta: '/carga',        roles: [1, 2]    },
    { icon: 'inventory_2',       label: 'Detalle',         ruta: '/detalle',      roles: [1, 2, 3] },
    { icon: 'assignment_return', label: 'Devoluciones',    ruta: '/devoluciones', roles: [1, 2, 3] },
    { icon: 'history',           label: 'Históricos',      ruta: '/historicos',   roles: [1, 2, 3] },
    { icon: 'trending_up',       label: 'Impactos',        ruta: '/impactos',     roles: [1, 2, 3] },
    { icon: 'verified',          label: 'Nivel Servicio',  ruta: '/nivel',        roles: [1, 2, 3] },
  ];

  get navItems() {
    return this.todasLasOpciones.filter(item => item.roles.includes(this.rolId));
  }

  isActive(ruta: string): boolean {
    return this.router.url === ruta;
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  // Solo para móvil — abre/cierra el drawer
  toggleMobile() {
    this.isMobileOpen = !this.isMobileOpen;
  }

  closeMobile() {
    this.isMobileOpen = false;
  }

  navegar(ruta: string) {
    this.closeMobile();
    this.router.navigate([ruta]);
  }
}