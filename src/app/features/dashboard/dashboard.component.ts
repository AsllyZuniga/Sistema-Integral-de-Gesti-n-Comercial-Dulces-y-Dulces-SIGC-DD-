import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
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
  imports: [CommonModule, CardComponent, FiltersComponent, SidebarComponent, VentasComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;

  vendedor:          any     = null;
  totales:           any     = null;
  isSidebarCollapsed         = false;
  proveedoresList:   string[] = [];
  ciudadesList:      string[] = [];

  filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin:    '',
    vendedor:    '',
    proveedor:   '',
    categoria:   '',
    ciudad:      '',
  };

  constructor(
    private authService:        AuthService,
    private router:             Router,
    private cumplimientoService: CumplimientoService,
    private cdr:                ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.vendedor = this.authService.getVendedor();

    if (!this.vendedor) {
      this.vendedor = {
        codigo:      '990',
        codVendedor: '990',
        nombre:      'Vendedor Prueba',
      };
    }

    this.cargarTotales();
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get codigoVendedor(): string {
    return this.vendedor?.codVendedor || this.vendedor?.codigo || '';
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  cargarTotales(): void {
    if (!this.codigoVendedor) return;

    this.cumplimientoService
      .getCumplimientoPorCodigo(this.codigoVendedor, this.filtrosActivos)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (!res) return;
        this.totales = {
          ventaAcum:        res.ventaAcum,
          cuotaMes:         res.cuotaMes,
          porcCump:         res.porcCump,
          proyeccionVenta:  res.proyeccionVenta,
        };
        this.cdr.detectChanges(); // ✅ notifica el cambio explícitamente
      });
  }

  cargarOpcionesFiltros(): void {
    if (!this.codigoVendedor) return;

    this.cumplimientoService
      .getProductosPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const listado = res?.data ?? [];
        this.proveedoresList = [
          ...new Set<string>(listado.map((r: any) => r.Proveedor).filter(Boolean)),
        ].sort();
        this.cdr.detectChanges(); // ✅ evita NG0100
      });

    this.cumplimientoService
      .getCiudadesPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const listado = res?.detallePorCiudad ?? [];
        this.ciudadesList = listado
          .map((r: any) => r.ciudad)
          .filter(Boolean)
          .sort();
        this.cdr.detectChanges(); // ✅ evita NG0100
      });
  }

  onAplicarFiltros(filtros: DashboardFilters): void {
    this.filtrosActivos = { ...filtros };
    this.cargarTotales();
  }

  onToggleSidebar(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}