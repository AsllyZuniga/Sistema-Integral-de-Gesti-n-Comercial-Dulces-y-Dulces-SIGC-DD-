import { Component, OnInit, OnDestroy } from '@angular/core';
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
    private cumplimientoService: CumplimientoService
  ) {}

  ngOnInit() {
    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.router.navigate(['/login']);
      return;
    }
    this.cargarVistaActual();
    this.ngOnDestroy();
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

    // 1. VENTAS (Individual del vendedor logueado)
    if (this.activeVentasView === 'ventas') {
      this.cumplimientoService.getCumplimientoPorCodigo(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          if (res) {
            // Guardamos los KPIs globales de la respuesta
            this.totales = {
              ventaAcum: res.ventaAcum,
              cuotaMes: res.cuotaMes,
              porcCump: res.porcCump,
              proyeccionVenta: res.proyeccionVenta
            };
            // Para la gráfica y tabla de esta pestaña, envolvemos el objeto en un array
            const dataArr = [res];
            this.cumplimientoData = dataArr;
            this.tableData = dataArr;
          }
        });
    }

    // 2. PROVEEDOR (Líneas del vendedor)
    else if (this.activeVentasView === 'proveedor') {
      this.cumplimientoService.getLineasPorVendedor(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          const listado = res?.detallePorLinea || [];
          this.cumplimientoData = [...listado];
          this.tableData = [...listado];
        });
    }

    // 3. VENDEDOR (Resumen general de TODOS los vendedores)
    else if (this.activeVentasView === 'vendedor') {
      this.cumplimientoService.getCumplimientoMes()
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          // Aquí 'res' ya debería ser un array de vendedores
          const listado = Array.isArray(res) ? res : [];
          this.cumplimientoData = [...listado];
          this.tableData = [...listado];
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