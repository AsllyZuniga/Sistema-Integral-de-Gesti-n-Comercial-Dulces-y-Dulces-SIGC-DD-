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

  tableColumns = ['Cliente', 'Proveedor', 'Total'];

  tableData = [
    { Cliente: 'Tienda Norte', Proveedor: 'Nestle', Total: 120000 },
    { Cliente: 'MiniMarket Centro', Proveedor: 'Mondelez', Total: 85000 }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.vendedor = this.authService.getVendedor();
  }
  isSidebarCollapsed = false;
  isMobileSidebarOpen = false;

onToggleSidebar(collapsed: boolean) {
  this.isSidebarCollapsed = collapsed;
}
toggleMobileSidebar() {
    this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}