import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../core/services/ventas/cumplimientoVentasSemana.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import {
  FiltersComponent,
  DashboardFilters,
} from '../../shared/components/filters/filters.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { VentasComponent } from '../dashboard/components/ventas/ventas.component';
import {
  CuotasCumplimientoComponent,
  TipoCuota,
} from '../cumplientosCuota/cumplimientos.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { DashboardRoleViewsModule } from './views/dashboard-role-views.module';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    FiltersComponent,
    SidebarComponent,
    VentasComponent,
    CuotasCumplimientoComponent,
    DashboardRoleViewsModule,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  constructor(
    private authService: AuthService,
    private router: Router,
    private cumplimientoService: CumplimientoService,
    private semanaService: CumplimientoSemanaService,
    private usuariosService: UsuariosService,
  ) {}

  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;

  vendedor: any = null;
  isSidebarCollapsed = false;

  proveedoresList: string[] = [];
  ciudadesList: string[] = [];
  lineasList: string[] = [];
  vendedoresList: string[] = [];

  tipoCuota: TipoCuota = 'mensual';
  rolId = 0;

  private proveedorMap: Map<string, string> = new Map();
  private ciudadMap: Map<string, string> = new Map();
  private lineaMap: Map<string, string> = new Map();
  private vendedorMap: Map<string, string> = new Map();

  private destroy$ = new Subject<void>();

  // Solo para vista vendedor
  totalesVendedor: any = null;

  filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    linea: '',
  };

  ngOnInit(): void {
    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.vendedor = { codigo: '990', codVendedor: '990', nombre: 'Vendedor Prueba' };
    }

    this.rolId = Number(this.vendedor?.rol?.idRol ?? this.vendedor?.idRol ?? 0);

    const { inicio, fin } = this.getDefaultDateRange();
    this.filtrosActivos.fechaInicio = inicio;
    this.filtrosActivos.fechaFin = fin;

    this.cargarOpcionesFiltros();

    if (this.rolId === 3) {
      this.cargarTotalesVendedor();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get esAdmin(): boolean {
    return this.rolId === 1;
  }

  get esSupervisor(): boolean {
    return this.rolId === 2;
  }

  get codigoVendedor(): string {
    return (
      this.vendedor?.codVendedor || this.vendedor?.codigo || this.vendedor?.codigo_vendedor || ''
    );
  }

  get labelCuota(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'Cuota Semana';
      case 'diaria':
        return 'Cuota Diaria';
      default:
        return 'Cuota Mes';
    }
  }

  get labelVentaAcum(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'Venta Semana';
      case 'diaria':
        return 'Venta Diaria';
      default:
        return 'Venta Mes';
    }
  }

  private getDefaultDateRange(): { inicio: string; fin: string } {
    const hoy = new Date();
    return {
      inicio: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      fin: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  onCambiarTipoCuota(tipo: TipoCuota): void {
    if (this.tipoCuota === tipo) return;
    this.tipoCuota = tipo;

    if (this.rolId === 3) {
      this.totalesVendedor = null;
      this.cargarTotalesVendedor();
    }
  }

  onToggleSidebar(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  cargarOpcionesFiltros(): void {
    this.cumplimientoService
      .getProveedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((proveedores) => {
        this.proveedorMap.clear();
        const unicos = new Set<string>();
        proveedores.forEach((item: any) => {
          if (item.nombre && item.codigo) {
            this.proveedorMap.set(item.nombre, item.codigo);
            unicos.add(item.nombre);
          }
        });
        this.proveedoresList = Array.from(unicos).sort();
      });

    if (this.esAdmin) {
      this.usuariosService
        .listarVendedores()
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: any[]) => {
          this.vendedorMap.clear();
          const etiquetas = new Set<string>();
          res.forEach((item: any) => {
            const codigo = item?.codigo_vendedor ?? item?.codVendedor ?? item?.username ?? '';
            const nombre = item?.nombre ?? '';
            if (codigo && nombre) {
              const etiqueta = `${String(codigo)} - ${String(nombre)}`;
              this.vendedorMap.set(etiqueta, String(codigo));
              etiquetas.add(etiqueta);
            }
          });
          this.vendedoresList = Array.from(etiquetas).sort();
        });
    }

    if (!this.esAdmin && this.codigoVendedor) {
      this.cumplimientoService
        .getLineasPorVendedor(this.codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado = res?.detallePorLinea ?? [];
          this.lineaMap.clear();
          const unicos = new Set<string>();
          listado.forEach((item: any) => {
            if (item.codigoLinea && item.linea) {
              this.lineaMap.set(item.linea, item.codigoLinea);
              unicos.add(item.linea);
            }
          });
          this.lineasList = Array.from(unicos).sort();
        });

      this.cumplimientoService
        .getCiudadesPorVendedor(this.codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado = res?.detallePorCiudad ?? [];
          this.ciudadMap.clear();
          const unicos = new Set<string>();
          listado.forEach((item: any) => {
            const cod = item.codCiudad || item.codigo || item.cod;
            if (item.ciudad && cod) {
              this.ciudadMap.set(item.ciudad, cod);
              unicos.add(item.ciudad);
            }
          });
          this.ciudadesList = Array.from(unicos).sort();
        });
    }
  }

  onAplicarFiltros(filtros: DashboardFilters): void {
    const filtrosConCodigos: DashboardFilters = {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin,
      vendedor: '',
      proveedor: '',
      categoria: filtros.categoria || '',
      ciudad: '',
      linea: filtros.linea || '',
    };

    if (filtros.vendedor) {
      filtrosConCodigos.vendedor = this.vendedorMap.get(filtros.vendedor) ?? filtros.vendedor;
    }
    if (filtros.proveedor) {
      filtrosConCodigos.proveedor = this.proveedorMap.get(filtros.proveedor) ?? filtros.proveedor;
    }
    if (filtros.ciudad) {
      filtrosConCodigos.ciudad = this.ciudadMap.get(filtros.ciudad) ?? filtros.ciudad;
    }
    if (filtros.linea) {
      filtrosConCodigos.linea = this.lineaMap.get(filtros.linea) ?? filtros.linea;
    }

    this.filtrosActivos = filtrosConCodigos;

    if (this.rolId === 3) {
      this.cargarTotalesVendedor();
    }
  }

  private cargarTotalesVendedor(): void {
    const filtros = { ...this.filtrosActivos };

    const obs$ =
      this.tipoCuota === 'semanal'
        ? this.semanaService.getCumplimientoSemanaVendedor(filtros)
        : this.cumplimientoService.getCumplimientoMesVendedor(filtros);

    const campo = this.tipoCuota === 'semanal' ? 'cuotaSemana' : 'cuotaMes';

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const detalle: any[] = (res?.detalle ?? []).filter((v: any) => v.codVendedor !== 'TOTALES');
        const d = detalle[0];
        if (!d) {
          this.totalesVendedor = null;
          return;
        }

        this.totalesVendedor = {
          ventaAcum: d.ventaAcum,
          cuotaMes: d[campo],
          porcCump: d.porcCump,
          proyeccionVenta: d.proyeccionVenta,
        };
      },
      error: () => {
        this.totalesVendedor = null;
      },
    });
  }
}
