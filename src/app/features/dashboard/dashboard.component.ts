import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

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
export class DashboardComponent {

  vendedor: any;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.vendedor = this.authService.getVendedor();
  }

  /* ================= SIDEBAR ================= */

  isSidebarCollapsed = false;
  isMobileMenuOpen: boolean = false;

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /* ================= VENTAS ================= */

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
  }

  /* ================= IMPACTOS ================= */

  activeImpactosView = 'impactos';

  impactosViews = [
    { key: 'impactos', label: 'Impactos' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad', label: 'Por Ciudad' },
    { key: 'item', label: 'Por Item' }
  ];

  setImpactosView(view: string) {
    this.activeImpactosView = view;
  }

  /* ================= DEVOLUCIONES ================= */

  devolucionesViews = [
    { key: 'cliente', label: 'Por Cliente' }
  ];

  activeDevolucionView = 'cliente';

  setDevolucionView(key: string) {
    this.activeDevolucionView = key;
  }

  devolucionesClientes = [
    {
      cliente: 'Tienda Norte',
      total: 50000,
      abierto: false,
      detalle: [
        { producto: 'Leche Entera', cantidad: 5, motivo: 'Vencido' },
        { producto: 'Galletas Oreo', cantidad: 3, motivo: 'Empaque Dañado' }
      ]
    },
    {
      cliente: 'MiniMarket Centro',
      total: 32000,
      abierto: false,
      detalle: [
        { producto: 'Yogurt Fresa', cantidad: 4, motivo: 'Mal estado' }
      ]
    }
  ];

  toggleDevolucion(cliente: any) {
    cliente.abierto = !cliente.abierto;
  }

  /* ================= NIVEL SERVICIO ================= */

  nivelServicioViews = [
    { key: 'agotados', label: 'Agotados por Proveedor' }
  ];

  activeNivelView = 'agotados';

  setNivelView(key: string) {
    this.activeNivelView = key;
  }

  agotadosProveedor = [
    {
      proveedor: 'Nestle',
      productos: ['Leche Entera', 'Café Nescafé']
    },
    {
      proveedor: 'Mondelez',
      productos: ['Oreo Vainilla', 'Chips Ahoy']
    }
  ];

  /* ================= HISTÓRICO ================= */

  historicoFiltro = '2m';

  setHistoricoFiltro(valor: string) {
    this.historicoFiltro = valor;
  }

  /* ================= TABLA ================= */

  tableColumns = ['Cliente', 'Proveedor', 'Total'];

  tableData = [
    { Cliente: 'Tienda Norte', Proveedor: 'Nestle', Total: 120000 },
    { Cliente: 'MiniMarket Centro', Proveedor: 'Mondelez', Total: 85000 }
  ];

}