import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
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

  totalesVendedor: any = null;

  filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    ciudadNombre: '',
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
    const codigoRaw =
      this.vendedor?.codVendedor || this.vendedor?.codigo || this.vendedor?.codigo_vendedor || '';
    return this.normalizarCodigoVendedor(codigoRaw);
  }

  private normalizarCodigoVendedor(valor: unknown): string {
    const codigo = String(valor ?? '').trim();
    if (!codigo) return '';
    return /^\d+$/.test(codigo) && codigo.length < 4 ? codigo.padStart(4, '0') : codigo;
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

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s.,-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private repararTextoCiudad(valor: unknown): string {
    const txt = String(valor ?? '').trim();
    if (!txt) return '';

    return txt
      .replace(/�/g, 'a')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private registrarCiudad(nombreCiudad: unknown, codigoCiudad: unknown, setCiudades: Set<string>): void {
    const ciudadOriginal = this.repararTextoCiudad(nombreCiudad);
    const ciudadNormalizada = this.normalizarTexto(ciudadOriginal);
    const codigo = String(codigoCiudad ?? '').trim();

    if (!ciudadOriginal || !ciudadNormalizada) return;

    if (codigo) {
      this.ciudadMap.set(ciudadOriginal, codigo);
      this.ciudadMap.set(ciudadNormalizada, codigo);
    }

    setCiudades.add(ciudadOriginal);
  }

  private cargarCiudadesYLineasSupervisor(): void {
    const idSupervisor = String(
      this.vendedor?.id_usuario ?? this.vendedor?.idUsuario ?? this.vendedor?.id ?? '',
    );

    if (!idSupervisor) {
      this.ciudadesList = [];
      this.lineasList = [];
      return;
    }

    this.usuariosService
      .obtenerVendedoresDelSupervisor(idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendedores: any[]) => {
        const codigos = vendedores
          .map((v: any) =>
            this.normalizarCodigoVendedor(v?.codigo_vendedor ?? v?.codVendedor ?? v?.codigo ?? ''),
          )
          .filter((c: string) => !!c);

        if (!codigos.length) {
          this.ciudadesList = [];
          this.lineasList = [];
          this.ciudadMap.clear();
          this.lineaMap.clear();
          return;
        }

        this.ciudadMap.clear();
        this.lineaMap.clear();

        const peticiones = codigos.map((codigo) =>
          forkJoin({
            ciudades: this.cumplimientoService.getCiudadesPorVendedor(codigo).pipe(
              catchError(() => of({ detallePorCiudad: [] }))
            ),
            lineas: this.cumplimientoService.getLineasPorVendedor(codigo).pipe(
              catchError(() => of({ detallePorLinea: [] }))
            ),
          })
        );

        forkJoin(peticiones)
          .pipe(takeUntil(this.destroy$))
          .subscribe((resultados) => {
            const ciudadesUnicas = new Set<string>();
            const lineasUnicas = new Set<string>();

            resultados.forEach((resultado: any) => {
              const ciudades = resultado?.ciudades?.detallePorCiudad ?? [];
              const lineas = resultado?.lineas?.detallePorLinea ?? [];

              ciudades.forEach((item: any) => {
                const cod =
                  item?.id_ciudad ??
                  item?.idCiudad ??
                  item?.codCiudad ??
                  item?.codigo ??
                  item?.cod ??
                  '';
                this.registrarCiudad(item?.ciudad, cod, ciudadesUnicas);
              });

              lineas.forEach((item: any) => {
                const linea = String(item?.linea ?? '').trim();
                const cod = String(item?.codigoLinea ?? '').trim();
                if (!linea) return;

                if (cod) {
                  this.lineaMap.set(linea, cod);
                }
                lineasUnicas.add(linea);
              });
            });

            this.ciudadesList = Array.from(ciudadesUnicas).sort((a, b) => a.localeCompare(b));
            this.lineasList = Array.from(lineasUnicas).sort((a, b) => a.localeCompare(b));
          });
      });
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

        this.proveedoresList = Array.from(unicos).sort((a, b) => a.localeCompare(b));
      });

    if (this.esAdmin) {
      this.cumplimientoService
        .getVendedores()
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: any[]) => {
          this.vendedorMap.clear();
          const etiquetas = new Set<string>();

          res.forEach((item: any) => {
            const codigo = this.normalizarCodigoVendedor(
              item?.codigo_vendedor ?? item?.codVendedor ?? item?.codigo ?? '',
            );
            const nombre = item?.nombre ?? item?.nom_vendedor ?? '';

            if (codigo && nombre) {
              const etiqueta = `${String(codigo)} - ${String(nombre)}`;
              this.vendedorMap.set(etiqueta, String(codigo));
              etiquetas.add(etiqueta);
            }
          });

          this.vendedoresList = Array.from(etiquetas).sort((a, b) => a.localeCompare(b));
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
            const linea = String(item?.linea ?? '').trim();
            const codigoLinea = String(item?.codigoLinea ?? '').trim();

            if (linea) {
              if (codigoLinea) this.lineaMap.set(linea, codigoLinea);
              unicos.add(linea);
            }
          });

          this.lineasList = Array.from(unicos).sort((a, b) => a.localeCompare(b));
        });

      this.cumplimientoService
        .getCiudadesPorVendedor(this.codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado = res?.detallePorCiudad ?? [];
          this.ciudadMap.clear();

          const unicos = new Set<string>();
          listado.forEach((item: any) => {
            const cod =
              item?.id_ciudad ??
              item?.idCiudad ??
              item?.codCiudad ??
              item?.codigo ??
              item?.cod ??
              '';
            this.registrarCiudad(item?.ciudad, cod, unicos);
          });

          this.ciudadesList = Array.from(unicos).sort((a, b) => a.localeCompare(b));
        });

      if (this.esSupervisor) {
        this.cargarCiudadesYLineasSupervisor();
      }
    }
  }

  onAplicarFiltros(filtros: DashboardFilters): void {
    const ciudadVisible = String(filtros.ciudad ?? '').trim();
    const ciudadNormalizada = this.normalizarTexto(ciudadVisible);

    const filtrosConCodigos: DashboardFilters = {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin,
      vendedor: '',
      proveedor: '',
      categoria: filtros.categoria || '',
      ciudad: '',
      ciudadNombre: ciudadVisible || '',
      linea: filtros.linea || '',
    };

    if (filtros.vendedor) {
      filtrosConCodigos.vendedor = this.vendedorMap.get(filtros.vendedor) ?? filtros.vendedor;
    }

    if (filtros.proveedor) {
      filtrosConCodigos.proveedor = this.proveedorMap.get(filtros.proveedor) ?? filtros.proveedor;
    }

    if (ciudadVisible) {
      filtrosConCodigos.ciudad =
        this.ciudadMap.get(ciudadVisible) ??
        this.ciudadMap.get(ciudadNormalizada) ??
        ciudadVisible;
    }

    if (filtros.linea) {
      filtrosConCodigos.linea = this.lineaMap.get(filtros.linea) ?? filtros.linea;
    }

    this.filtrosActivos = { ...filtrosConCodigos };

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