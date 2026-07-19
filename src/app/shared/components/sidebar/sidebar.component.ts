import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { MenuItem, obtenerMenuItemsPorRol } from '../../../core/auth/menu-items';
import { nombreRol } from '../../../core/auth/roles';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  isCollapsed = false;
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
    return nombreRol(this.rolId);
  }

  get navItems(): MenuItem[] {
    return obtenerMenuItemsPorRol(this.rolId, {
      ventas: this.session.tieneAccesoVentas(),
      cuotas: this.session.tieneAccesoCuotas(),
      usuarios: this.session.tieneAccesoGestionUsuarios(),
    });
  }

  isActive(item: MenuItem): boolean {
    const url = this.router.parseUrl(this.router.url);
    const primary = url.root.children['primary'];
    const path = '/' + (primary?.segments.map((segment) => segment.path).join('/') ?? '');

    if (path !== item.ruta) {
      return false;
    }

    if (!item.activoPorParams) {
      return true;
    }

    return Object.entries(item.activoPorParams).every(
      ([key, value]) => String(url.queryParams[key] ?? '').toLowerCase() === value.toLowerCase(),
    );
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
}
