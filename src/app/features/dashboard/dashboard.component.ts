import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';

import { CardComponent } from '../../shared/components/card/card.component';
import { ChartComponent } from '../../shared/components/chart/chart.component';
import { TableComponent } from '../../shared/components/table/table.component';
import { FiltersComponent } from '../../shared/components/filters/filters.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, CardComponent, ChartComponent,
    TableComponent, FiltersComponent, SidebarComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  vendedor: any;
  activeVentasView = 'ventas';
  isSidebarCollapsed = false;
  isMobileMenuOpen = false;

  // Data
  cumplimientoData: any[] = [];
  tableData: any[] = [];
  totales: any = null;

  readonly ventasViews = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad', label: 'Por Ciudad' },
    { key: 'vendedor', label: 'Por Vendedor' },
    { key: 'item', label: 'Detalle por Item' },
    { key: 'cliente', label: 'Cliente Detallado' }
  ];

  readonly tableColumns = ['codVendedor', 'nombre', 'cuotaMes', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly lineasColumns = ['linea', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];

  constructor(
    private authService: AuthService,
    private router: Router,
    private cumplimientoService: CumplimientoService,
    private cdr: ChangeDetectorRef // <-- Inyectamos el detector de cambios
  ) { }

  ngOnInit() {
    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.router.navigate(['/login']);
      return;
    }
    this.cargarVistaActual();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setVentasView(view: string) {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.cargarVistaActual();
  }

  cargarVistaActual() {
    const codigoVendedor = this.vendedor?.codVendedor || this.vendedor?.codigo;
    if (!codigoVendedor) return;

    // Limpiamos los arreglos al cambiar de pestaña
    this.cumplimientoData = [];
    this.tableData = [];

    // 1. VENTAS
    if (this.activeVentasView === 'ventas') {
      this.cumplimientoService.getCumplimientoPorCodigo(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          if (res) {
            this.totales = {
              ventaAcum: res.ventaAcum,
              cuotaMes: res.cuotaMes,
              porcCump: res.porcCump,
              proyeccionVenta: res.proyeccionVenta
            };
            this.cumplimientoData = [res];
            this.tableData = [res];
          }
          this.cdr.detectChanges(); // <-- Forzamos a que Angular redibuje inmediatamente
        });
    }

    // 2. PROVEEDOR
    else if (this.activeVentasView === 'proveedor') {
      this.cumplimientoService.getLineasPorVendedor(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          const listado = res?.detallePorLinea || [];
          this.cumplimientoData = [...listado];
          this.tableData = [...listado];
          this.cdr.detectChanges(); // <-- SOLUCIÓN AL DOBLE CLIC
        });
    }

    // 3. VENDEDOR (Restaurado para mostrar el vendedor logueado correctamente)
    else if (this.activeVentasView === 'vendedor') {
      this.cumplimientoService.getCumplimientoPorCodigo(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          if (res) {
            this.cumplimientoData = [res];
            this.tableData = [res];
          }
          this.cdr.detectChanges(); // <-- Forzamos actualización visual
        });
    }
  }

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}