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
    CommonModule,
    CardComponent,
    ChartComponent,
    TableComponent,
    FiltersComponent,
    SidebarComponent
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

  tableData: any[] = [];
  chartData: any[] = [];

  chartType: 'line' | 'bar' | 'pie' = 'line';

  totales: any = null;

  readonly ventasViews = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad', label: 'Por Ciudad' },
    { key: 'vendedor', label: 'Por Vendedor' },
    { key: 'item', label: 'Detalle por Item' },
    { key: 'cliente', label: 'Cliente Detallado' }
  ];

  readonly tableColumns = ['codVendedor','nombre','cuotaMes','ventaAcum','porcCump','proyeccionVenta','porcCumProy'];
  readonly lineasColumns = ['linea','ventaAcum','porcCump','proyeccionVenta','porcCumProy'];
  readonly ciudadesColumns = ['ciudad','ventaAcum','porcCump','proyeccionVenta','porcCumProy'];

  constructor(
    private authService: AuthService,
    private router: Router,
    private cumplimientoService: CumplimientoService,
    private cdr: ChangeDetectorRef
  ) {}

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

    this.tableData = [];
    this.chartData = [];

    if (this.activeVentasView === 'ventas') {

      this.chartType = 'line';

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

            this.tableData = [res];

            this.chartData = [
              { name: 'Venta', value: res.ventaAcum },
              { name: 'Cuota', value: res.cuotaMes },
              { name: 'Proyección', value: res.proyeccionVenta }
            ];
          }

          this.cdr.detectChanges();
        });
    }

    else if (this.activeVentasView === 'proveedor') {

      this.chartType = 'bar';

      this.cumplimientoService.getLineasPorVendedor(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {

          const listado = res?.detallePorLinea || [];

          this.tableData = listado;

          this.chartData = listado.map((item: any) => ({
            name: item.linea,
            value: item.ventaAcum
          }));

          this.cdr.detectChanges();
        });
    }

    else if (this.activeVentasView === 'ciudad') {

      this.chartType = 'pie';

      this.cumplimientoService.getCiudadesPorVendedor(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {

          const listado = res?.detallePorCiudad || [];

          this.tableData = listado;

          this.chartData = listado.map((item: any) => ({
            name: item.ciudad,
            value: item.ventaAcum
          }));

          this.cdr.detectChanges();
        });
    }

    else if (this.activeVentasView === 'vendedor') {

      this.chartType = 'bar';

      this.cumplimientoService.getCumplimientoPorCodigo(codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {

          if (res) {
            this.tableData = [res];
            this.chartData = [
              { name: res.nombre, value: res.ventaAcum }
            ];
          }

          this.cdr.detectChanges();
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