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
import { ImpactosComponent } from './components/impactos/impactos.component';
import { DevolucionesComponent } from './components/devoluciones/devoluciones.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    FiltersComponent,
    SidebarComponent,
    VentasComponent,
    ImpactosComponent,
    DevolucionesComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  vendedor: any;
  totales: any = null;
  isSidebarCollapsed = false;
  isMobileMenuOpen = false;

  // Opciones para los dropdowns del filtro
  proveedoresList: string[] = [];
  categoriasList:  string[] = [];
  ciudadesList:    string[] = [];
  vendedoresList:  string[] = [];

  filtrosActivos: DashboardFilters = {
    fechaInicio: '', fechaFin: '', vendedor: '',
    proveedor: '', categoria: '', ciudad: '',
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private cumplimientoService: CumplimientoService,
  ) {}

  ngOnInit() {
    this.vendedor = this.authService.getVendedor();

    // ── TEMPORAL: hardcode para desarrollo sin login ──
    if (!this.vendedor) {
      this.vendedor = {
        codigo: '990',
        codVendedor: '990',
        nombre: 'Vendedor Prueba'
      };
    }
    // ─────────────────────────────────────────────────

    /* if (!this.vendedor) {
      this.router.navigate(['/login']);
      return;
    } */

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
          proyeccionVenta: res.proyeccionVenta,
        };
      });
  }

  cargarOpcionesFiltros() {
    if (!this.codigoVendedor) return;

    this.cumplimientoService
      .getProductosPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        const listado = res?.data ?? [];
        this.proveedoresList = [...new Set<string>(listado.map((r: any) => r.Proveedor).filter(Boolean))].sort();
      });

    this.cumplimientoService
      .getCiudadesPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        const listado = res?.detallePorCiudad ?? [];
        this.ciudadesList = listado.map((r: any) => r.ciudad).filter(Boolean).sort();
      });

    this.cumplimientoService
      .getLineasPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        const listado = res?.detallePorLinea ?? [];
        this.categoriasList = listado.map((r: any) => r.linea).filter(Boolean).sort();
      });
  }

  // Recibe los filtros aplicados desde FiltersComponent
  onAplicarFiltros(filtros: DashboardFilters) {
    this.filtrosActivos = { ...filtros };
    this.cargarTotales();
    this.cargarOpcionesFiltros(); 
  }

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}