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
    console.log('📍 [DASHBOARD] ngOnInit iniciado');
    
    // Verificar directamente en sessionStorage
    const vendedorRaw = sessionStorage.getItem('vendedor');
    console.log('🔍 [DASHBOARD] vendedor RAW en sessionStorage:', vendedorRaw);
    
    this.vendedor = this.authService.getVendedor();
    console.log('👤 [DASHBOARD] Vendedor obtenido del AuthService:', this.vendedor);

    if (!this.vendedor || this.vendedor === null) {
      console.warn('⚠️ [DASHBOARD] Vendedor es null, usando valores por defecto');
      this.vendedor = {
        codigo:      '990',
        codVendedor: '990',
        nombre:      'Vendedor Prueba',
      };
    }

    console.log('✅ [DASHBOARD] codigoVendedor final:', this.codigoVendedor);

    // Establecer fechas por defecto del mes actual
    const { inicio, fin } = this.getDefaultDateRange();
    this.filtrosActivos.fechaInicio = inicio;
    this.filtrosActivos.fechaFin = fin;

    console.log('📅 [DASHBOARD] Filtros iniciales:', this.filtrosActivos);

    this.cargarTotales();
    this.cargarOpcionesFiltros();
  }

  private getDefaultDateRange(): { inicio: string; fin: string } {
    const hoy = new Date();
    const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const inicio = this.formatDate(primerDiaDelMes);
    const fin = this.formatDate(ultimoDiaDelMes);

    return { inicio, fin };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    console.log('🔄 Cargando totales con código:', this.codigoVendedor);
    console.log('📋 Filtros enviados:', this.filtrosActivos);

    this.cumplimientoService
      .getCumplimientoPorCodigo(this.codigoVendedor, this.filtrosActivos)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          console.log('✅ Respuesta recibida del backend:', res);
          if (!res || !res.totales) {
            console.warn('⚠️ respuesta vacía o sin totales');
            return;
          }
          this.totales = {
            ventaAcum:        res.totales.ventaAcum,
            cuotaMes:         res.totales.cuotaMes,
            porcCump:         res.totales.porcCump,
            proyeccionVenta:  res.totales.proyeccionVenta,
          };
          console.log('💾 Totales guardados:', this.totales);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('❌ Error al cargar totales:', err);
        }
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