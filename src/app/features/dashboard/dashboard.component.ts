import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';

import { CardComponent } from '../../shared/components/card/card.component';
import { FiltersComponent, DashboardFilters } from '../../shared/components/filters/filters.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { VentasComponent } from '../dashboard/components/ventas/ventas.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    FiltersComponent,
    SidebarComponent,
    VentasComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  vendedor: any;
  totales: any = null;
  isSidebarCollapsed = false;
  isMobileMenuOpen = false;

  // Listas para los dropdowns del filtro
  proveedoresList: string[] = [];
  categoriasList:  string[] = [];
  ciudadesList:    string[] = [];
  vendedoresList:  string[] = [];

  // Filtros activos — se pasan como @Input a VentasComponent
  filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin:    '',
    vendedor:    '',
    proveedor:   '',
    categoria:   '',
    ciudad:      '',
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private cumplimientoService: CumplimientoService
  ) {}

  ngOnInit() {
    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.router.navigate(['/login']);
      return;
    }
    this.cargarTotales();
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get codigoVendedor(): string {
    return this.vendedor?.codVendedor || this.vendedor?.codigo || '';
  }

  // ── Carga las tarjetas superiores ─────────────────────────────
  cargarTotales() {
    if (!this.codigoVendedor) return;
    this.cumplimientoService
      .getCumplimientoPorCodigo(this.codigoVendedor, this.filtrosActivos)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (!res) return;
        this.totales = {
          ventaAcum:       res.ventaAcum,
          cuotaMes:        res.cuotaMes,
          porcCump:        res.porcCump,
          proyeccionVenta: res.proyeccionVenta
        };
      });
  }

  // ── Puebla los dropdowns del FiltersComponent ─────────────────
  cargarOpcionesFiltros() {
    if (!this.codigoVendedor) return;

    // Proveedores únicos desde productos
    this.cumplimientoService
      .getProductosPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        const listado = res?.data ?? [];
        this.proveedoresList = [
          ...new Set<string>(listado.map((r: any) => r.Proveedor).filter(Boolean))
        ].sort();
      });

    // Ciudades únicas
    this.cumplimientoService
      .getCiudadesPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        const listado = res?.detallePorCiudad ?? [];
        this.ciudadesList = listado.map((r: any) => r.ciudad).filter(Boolean).sort();
      });

    // Categorías/líneas únicas
    this.cumplimientoService
      .getLineasPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        const listado = res?.detallePorLinea ?? [];
        this.categoriasList = listado.map((r: any) => r.linea).filter(Boolean).sort();
      });
  }

  // ── Recibe el evento (apply) del FiltersComponent ─────────────
  onAplicarFiltros(filtros: DashboardFilters) {
    this.filtrosActivos = { ...filtros };
    // Refresca también las tarjetas con los nuevos filtros
    this.cargarTotales();
  }

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}