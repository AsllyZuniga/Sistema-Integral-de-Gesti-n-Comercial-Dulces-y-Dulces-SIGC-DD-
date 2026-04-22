import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';

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
  rolId = 0;

  @Output() toggle = new EventEmitter<boolean>();

  constructor(
    private router: Router,
    private session: SessionService,
  ) {
    this.rolId = this.session.getRoleId();
  }

  get tituloRol(): string {
    if (this.rolId === 1) return 'Admin';
    if (this.rolId === 2) return 'Supervisor';
    return 'Vendedor';
  }

  get esVendedor(): boolean {
    return this.rolId !== 1 && this.rolId !== 2;
  }

  private readonly todasLasOpciones = [
    { icon: 'upload_file', label: 'Carga de Ventas', ruta: '/carga',     roles: [1]      },
    { icon: 'request_quote', label: 'Carga de Cuotas', ruta: '/carga-cuotas', roles: [1] },
    { icon: 'group',       label: 'Gestión Usuarios', ruta: '/gestion-usuarios', roles: [1] },

    // ⏸️ Módulos pendientes de implementación
    // { icon: 'inventory_2',       label: 'Detalle',        ruta: '/detalle',      roles: [1, 2, 3] },
    // { icon: 'assignment_return', label: 'Devoluciones',   ruta: '/devoluciones', roles: [1, 2, 3] },
    // { icon: 'history',           label: 'Históricos',     ruta: '/historicos',   roles: [1, 2, 3] },
    // { icon: 'verified',          label: 'Nivel Servicio', ruta: '/nivel',        roles: [1, 2, 3] },
  ];

  get navItems() {
    return this.todasLasOpciones.filter((item) => item.roles.includes(this.rolId));
  }

  isVendedorVistaActive(vista: 'ventas' | 'impactos'): boolean {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    const path = '/' + (primary?.segments.map((s) => s.path).join('/') ?? '');

    if (path !== '/dashboard') return false;

    const vistaActual = String(url.queryParams['vista'] ?? 'ventas').toLowerCase();
    return vista === 'impactos' ? vistaActual === 'impactos' : vistaActual !== 'impactos';
  }

  isActive(ruta: string): boolean {
    return this.router.url === ruta;
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }

  toggleMobile() {
    this.isMobileOpen = !this.isMobileOpen;
  }

  closeMobile() {
    this.isMobileOpen = false;
  }
}