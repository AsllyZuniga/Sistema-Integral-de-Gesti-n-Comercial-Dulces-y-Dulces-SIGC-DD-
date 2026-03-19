import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../core/services/ventas/cumplimientoVentasSemana.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { CardComponent } from '../../shared/components/card/card.component';
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
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {

  // ─── Inyección con inject() — evita NG2003 en standalone ─────────────────────
  private authService         = inject(AuthService);
  private router              = inject(Router);
  private cumplimientoService = inject(CumplimientoService);       // MES
  private semanaService       = inject(CumplimientoSemanaService); // SEMANA
  private proveedorService    = inject(ProveedorService);
  private cdr                 = inject(ChangeDetectorRef);

  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;

  // ─── Estado ──────────────────────────────────────────────────────────────────
  vendedor:           any       = null;
  totales:            any       = null;
  isSidebarCollapsed            = false;
  proveedoresList:    string[]  = [];
  ciudadesList:       string[]  = [];
  lineasList:         string[]  = [];
  tipoCuota:          TipoCuota = 'mensual';
  rolId                         = 0;
  cargandoVendedores            = false;

  todosLosVendedores: any[]    = [];
  vendedoresList:     string[] = [];

  private proveedorMap: Map<string, string> = new Map();
  private ciudadMap:    Map<string, string> = new Map();
  private lineaMap:     Map<string, string> = new Map();
  private vendedorMap:  Map<string, string> = new Map();

  private destroy$ = new Subject<void>();

  filtrosActivos: DashboardFilters = {
    fechaInicio: '', fechaFin: '', vendedor: '',
    proveedor: '', categoria: '', ciudad: '', linea: '',
  };

  constructor() {}

  // ─── Ciclo de vida ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.vendedor = { codigo: '990', codVendedor: '990', nombre: 'Vendedor Prueba' };
    }
    this.rolId = Number(this.vendedor?.rol?.idRol ?? this.vendedor?.idRol ?? 0);

    const { inicio, fin } = this.getDefaultDateRange();
    this.filtrosActivos.fechaInicio = inicio;
    this.filtrosActivos.fechaFin    = fin;

    this.cargarTotales();
    this.cargarOpcionesFiltros();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Getters de rol y vendedor ───────────────────────────────────────────────
  get esAdmin(): boolean {
    return this.rolId === 1 || this.rolId === 2;
  }

  get codigoVendedor(): string {
    return this.vendedor?.codVendedor || this.vendedor?.codigo || '';
  }

  // ─── Getters de etiquetas dinámicas según tipoCuota ─────────────────────────

  /** Etiqueta del botón/columna de cuota */
  get labelCuota(): string {
    switch (this.tipoCuota) {
      case 'semanal': return 'Cuota Semana';
      case 'diaria':  return 'Cuota Diaria';
      default:        return 'Cuota Mes';
    }
  }

  /** Campo del objeto vendedor que contiene la cuota según el periodo activo */
  get campoCuota(): string {
    switch (this.tipoCuota) {
      case 'semanal': return 'cuotaSemana';
      case 'diaria':  return 'cuotaDiaria';
      default:        return 'cuotaMes';
    }
  }

  /** Etiqueta de la venta acumulada según el periodo activo */
  get labelVentaAcum(): string {
    switch (this.tipoCuota) {
      case 'semanal': return 'Venta Semana';
      case 'diaria':  return 'Venta Diaria';
      default:        return 'Venta Mes';
    }
  }

  // ─── Helpers de fecha ────────────────────────────────────────────────────────
  private getDefaultDateRange(): { inicio: string; fin: string } {
    const hoy = new Date();
    return {
      inicio: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      fin:    this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── Acciones UI ─────────────────────────────────────────────────────────────
  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  /**
   * Se dispara cuando el usuario hace click en Cuota Diaria / Semanal / Mensual.
   * Actualiza tipoCuota y recarga los totales con el servicio correcto.
   */
  onCambiarTipoCuota(tipo: TipoCuota): void {
    if (this.tipoCuota === tipo) return; // evitar recargas innecesarias
    this.tipoCuota = tipo;
    this.totales   = null; // limpiar cards mientras carga
    this.cdr.detectChanges();
    this.cargarTotales();
  }

  onToggleSidebar(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // ─── Carga de totales ────────────────────────────────────────────────────────
  /**
   * Decide qué servicio usar según tipoCuota:
   *   'semanal' → CumplimientoSemanaService  (/semana/...)
   *   'mensual' → CumplimientoService        (/mes/...)
   */
  cargarTotales(): void {
    const filtros = { ...this.filtrosActivos };

    if (this.tipoCuota === 'semanal') {
      // ── SEMANA ──────────────────────────────────────────────────────────────
      const obs$ = this.esAdmin
        ? this.semanaService.getCumplimientoSemanaAdmin(filtros)
        : this.semanaService.getCumplimientoSemanaVendedor(filtros);

      this.esAdmin
        ? this.cargarDesdeEndpointAdmin(obs$, 'cuotaSemana')
        : this.cargarDesdeEndpointVendedor(obs$, 'cuotaSemana');

    } else {
      // ── MES (default) ───────────────────────────────────────────────────────
      const obs$ = this.esAdmin
        ? this.cumplimientoService.getCumplimientoMesAdmin(filtros)
        : this.cumplimientoService.getCumplimientoMesVendedor(filtros);

      this.esAdmin
        ? this.cargarDesdeEndpointAdmin(obs$, 'cuotaMes')
        : this.cargarDesdeEndpointVendedor(obs$, 'cuotaMes');
    }
  }

  private cargarDesdeEndpointAdmin(obs$: any, campoCuota: string): void {
    this.cargandoVendedores = true;
    this.todosLosVendedores = [];

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const detalle: any[] = (res?.detalle ?? []).filter(
          (v: any) => v.codVendedor !== 'TOTALES'
        );

        const lista = this.filtrosActivos.vendedor
          ? detalle.filter((v: any) => v.codVendedor === this.filtrosActivos.vendedor)
          : detalle;

        this.todosLosVendedores = lista;

        // Reconstruir lista de vendedores para el filtro
        this.vendedorMap.clear();
        const nombresUnicos = new Set<string>();
        detalle.forEach((v: any) => {
          if (v.nombre && v.codVendedor) {
            this.vendedorMap.set(v.nombre, v.codVendedor);
            nombresUnicos.add(v.nombre);
          }
        });
        this.vendedoresList = Array.from(nombresUnicos).sort();

        // Calcular totales para las cards KPI
        const ventaAcum       = lista.reduce((s: number, v: any) => s + (Number(v.ventaAcum)      || 0), 0);
        const cuota           = lista.reduce((s: number, v: any) => s + (Number(v[campoCuota])     || 0), 0);
        const proyeccionVenta = lista.reduce((s: number, v: any) => s + (Number(v.proyeccionVenta) || 0), 0);
        const porcCump        = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

        // cuotaMes se usa como campo genérico en totales para el card
        this.totales            = { ventaAcum, cuotaMes: cuota, porcCump, proyeccionVenta };
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.totales            = null;
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
    });
  }

  private cargarDesdeEndpointVendedor(obs$: any, campoCuota: string): void {
    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const detalle: any[] = (res?.detalle ?? []).filter(
          (v: any) => v.codVendedor !== 'TOTALES'
        );
        const d = detalle[0];
        if (!d) { this.totales = null; this.cdr.detectChanges(); return; }

        this.totales = {
          ventaAcum:       d.ventaAcum,
          cuotaMes:        d[campoCuota], // campo genérico para el card
          porcCump:        d.porcCump,
          proyeccionVenta: d.proyeccionVenta,
        };
        this.cdr.detectChanges();
      },
      error: () => { this.totales = null; this.cdr.detectChanges(); },
    });
  }

  // ─── Opciones para filtros desplegables ──────────────────────────────────────
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

  // ─── Aplicar filtros desde FiltersComponent ──────────────────────────────────
  onAplicarFiltros(filtros: DashboardFilters): void {
    const filtrosConCodigos: DashboardFilters = {
      fechaInicio: filtros.fechaInicio,
      fechaFin:    filtros.fechaFin,
      vendedor:    '',
      proveedor:   '',
      categoria:   filtros.categoria || '',
      ciudad:      '',
      linea:       filtros.linea     || '',
    };

    if (filtros.vendedor)  filtrosConCodigos.vendedor  = this.vendedorMap.get(filtros.vendedor)   ?? filtros.vendedor;
    if (filtros.proveedor) filtrosConCodigos.proveedor = this.proveedorMap.get(filtros.proveedor) ?? filtros.proveedor;
    if (filtros.ciudad)    filtrosConCodigos.ciudad    = this.ciudadMap.get(filtros.ciudad)        ?? filtros.ciudad;
    if (filtros.linea)     filtrosConCodigos.linea     = this.lineaMap.get(filtros.linea)          ?? filtros.linea;

    this.filtrosActivos = filtrosConCodigos;
    this.cargarTotales();
  }
}