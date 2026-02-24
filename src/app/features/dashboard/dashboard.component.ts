import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class DashboardComponent implements OnInit {

  vendedor: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private cumplimientoService: CumplimientoService
  ) {
    this.vendedor = this.authService.getVendedor();
  }

  ngOnInit() {
    this.cargarVistaActual();
  }

  /* SIDEBAR */

  isSidebarCollapsed = false;
  isMobileMenuOpen = false;

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /* TABS */

  activeVentasView = 'ventas';

  ventasViews = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad', label: 'Por Ciudad' },
    { key: 'vendedor', label: 'Por Vendedor' },
    { key: 'item', label: 'Detalle por Item' },
    { key: 'cliente', label: 'Cliente Detallado' }
  ];

  setVentasView(view: string) {
    this.activeVentasView = view;
    this.cargarVistaActual();
  }

  /* DATA */

  cumplimientoData: any[] = [];
  tableData: any[] = [];
  totales: any;

  /* COLUMNAS */

  // TABLA VENDEDORES
  tableColumns = [
    'codVendedor',
    'nombre',
    'cuotaMes',
    'ventaAcum',
    'porcCump',
    'proyeccionVenta',
    'porcCumProy'
  ];

  // TABLA LINEAS
  lineasColumns = [
    'linea',
    'ventaAcum',
    'porcCump',
    'proyeccionVenta',
    'porcCumProy'
  ];

  /* CARGAR DATA */

  cargarVistaActual() {

    const codigoVendedor =
      this.vendedor?.codVendedor || this.vendedor?.codigo;

    if (!codigoVendedor) return;

    // VENTAS
    if (this.activeVentasView === 'ventas') {

      this.cumplimientoService
        .getCumplimientoPorCodigo(codigoVendedor)
        .subscribe((res: any) => {

          this.cumplimientoData = [res];
          this.tableData = [res];

          this.totales = {
            ventaAcum: res.ventaAcum,
            cuotaMes: res.cuotaMes,
            porcCump: res.porcCump,
            proyeccionVenta: res.proyeccionVenta
          };

        });

    }

    // PROVEEDOR (LINEAS)
  if (this.activeVentasView === 'proveedor') {

  this.cumplimientoService
    .getLineasPorVendedor(codigoVendedor)
    .subscribe((res: any) => {

      this.cumplimientoData = res.detallePorLinea;
      this.tableData = res.detallePorLinea;

    });

}

    // VENDEDOR GENERAL
    if (this.activeVentasView === 'vendedor') {

      this.cumplimientoService
        .getCumplimientoMes()
        .subscribe((res: any) => {

          this.cumplimientoData = res;
          this.tableData = res;

        });

    }

  }

}