import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';

import { CardComponent } from '../../shared/components/card/card.component';
import { FiltersComponent } from '../../shared/components/filters/filters.component';
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

    const codigo = this.vendedor?.codVendedor || this.vendedor?.codigo;
    this.cumplimientoService
      .getCumplimientoPorCodigo(codigo)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (!res) return;
        this.totales = {
          ventaAcum:        res.ventaAcum,
          cuotaMes:         res.cuotaMes,
          porcCump:         res.porcCump,
          proyeccionVenta:  res.proyeccionVenta
        };
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get codigoVendedor(): string {
    return this.vendedor?.codVendedor || this.vendedor?.codigo || '';
  }

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}