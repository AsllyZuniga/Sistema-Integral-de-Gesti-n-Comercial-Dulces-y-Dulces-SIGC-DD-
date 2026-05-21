import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionUser } from '../../core/services/session.service';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../core/services/ventas/cumplimientoVentasSemana.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import {
  FiltersComponent,
  DashboardFilters,
} from '../../shared/components/filters/filters.component';
import { FilterOption } from '../../shared/components/filters/filters.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { VentasComponent } from '../dashboard/components/ventas/ventas.component';
import { ImpactosComponent } from '../dashboard/components/impactos/impactos.component';
import {
  CuotasCumplimientoComponent,
  TipoCuota,
} from '../cumplimientos-cuota/cumplimientos.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { DashboardRoleViewsModule } from './views/dashboard-role-views.module';

interface DashboardTotalesVendedor {
  ventaAcum?: number;
  cuotaMes?: number;
  cuotaDiaria?: number;
  cuotaSemana?: number;
  porcCump?: number;
  proyeccionVenta?: number;
  codVendedor?: string;
}

interface ApiProveedorRow {
  nombre?: string;
  codigo?: string;
}

interface ApiVendedorRow {
  codigo_vendedor?: string;
  codVendedor?: string;
  codigo?: string;
  cod?: string;
  nombre?: string;
  nom_vendedor?: string;
  nomVendedor?: string;
}

interface ApiLineaRow {
  linea?: string;
  codigoLinea?: string;
}

interface ApiCiudadesResponse {
  detallePorCiudad?: ApiCiudadRow[];
}

interface ApiLineasResponse {
  detallePorLinea?: ApiLineaRow[];
}

interface ApiCiudadRow {
  ciudad?: string;
  id_ciudad?: string | number;
  idCiudad?: string | number;
  codCiudad?: string | number;
  codigo?: string | number;
  cod?: string | number;
}

interface ApiCategoriaRow {
  id_categoria?: number | string;
  idCategoria?: number | string;
  categoria_id?: number | string;
  categoria?: string;
  nomCategoria?: string;
  nombreCategoria?: string;
}

interface ApiTotalesResponse<TDetalle> {
  detalle?: TDetalle[];
}

interface CumplimientoAdminDetalleRow {
  ciudad?: string;
  nomCiudad?: string;
  nombreCiudad?: string;
  linea?: string;
  nomLinea?: string;
  nombreLinea?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    FiltersComponent,
    SidebarComponent,
    VentasComponent,
    ImpactosComponent,
    CuotasCumplimientoComponent,
    DashboardRoleViewsModule,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private cumplimientoService: CumplimientoService,
    private semanaService: CumplimientoSemanaService,
    private usuariosService: UsuariosService,
  ) {}

  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;
  @ViewChild(VentasComponent) ventasRef?: VentasComponent;

  vendedor: SessionUser | null = null;
  isSidebarCollapsed = false;

  proveedoresList: FilterOption[] = [];
  categoriasList: FilterOption[] = [];
  ciudadesList: FilterOption[] = [];
  lineasList: FilterOption[] = [];
  vendedoresList: FilterOption[] = [];

  tipoCuota: TipoCuota = 'mensual';
  rolId = 0;
  activeAnalisisView: 'ventas' | 'impactos' = 'ventas';
  activeSupervisorView: 'asignados' | 'analisis' = 'asignados';

  private proveedorMap: Map<string, string> = new Map();
  private ciudadMap: Map<string, string> = new Map();
  private lineaMap: Map<string, string> = new Map();
  private vendedorMap: Map<string, string> = new Map();

  private destroy$ = new Subject<void>();
  private codigoVendedorDetectado = '';

  totalesVendedor: DashboardTotalesVendedor | null = null;

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
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const vista = String(params.get('vista') ?? 'ventas').toLowerCase();
      const seccion = String(params.get('seccion') ?? 'asignados').toLowerCase();

      // Evitar que vendedores (rolId 3) activen la vista de 'impactos'. Si el usuario
      // actual es vendedor, forzamos 'ventas' aunque el query param pida 'impactos'.
      const usuarioActual = this.authService.getVendedor();
      const rolActual = Number(usuarioActual?.rol?.idRol ?? usuarioActual?.idRol ?? 0);

      if (vista === 'impactos' && rolActual === 3) {
        this.activeAnalisisView = 'ventas';
      } else {
        this.activeAnalisisView = vista === 'impactos' ? 'impactos' : 'ventas';
      }

      this.activeSupervisorView = seccion === 'analisis' ? 'analisis' : 'asignados';
    });

    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.vendedor = {
        codigo: '990',
        codVendedor: '990',
        nombre: 'Vendedor Prueba',
        idRol: 3,
      };
    }

    this.rolId = Number(this.vendedor?.rol?.idRol ?? this.vendedor?.idRol ?? 0);

    this.resolverRangoInicialConDatos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    // Asegura que la vista de ventas cargue cuando el ViewChild esté disponible
    if (this.ventasRef && this.filtrosActivos && this.filtrosActivos.fechaInicio) {
      // Ligeramente async para evitar ExpressionChangedAfterItHasBeenCheckedError
      setTimeout(() => this.ventasRef?.reloadView(true), 0);
    }
  }

  get esAdmin(): boolean {
    return this.rolId === 1;
  }

  get esSupervisor(): boolean {
    return this.rolId === 2;
  }

  get codigoVendedor(): string {
    if (this.codigoVendedorDetectado) {
      return this.codigoVendedorDetectado;
    }

    const codigoRaw =
      this.vendedor?.codVendedor ??
      this.vendedor?.codigo ??
      this.vendedor?.codigo_vendedor ??
      this.vendedor?.vendedor?.codVendedor ??
      this.vendedor?.vendedor?.codigo ??
      this.vendedor?.vendedor?.codigo_vendedor ??
      '';
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

  private getMonthRangeFromOffset(offsetMeses: number): { inicio: string; fin: string } {
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - offsetMeses, 1);
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() - offsetMeses + 1, 0);
    return { inicio: this.formatDate(inicio), fin: this.formatDate(fin) };
  }

  private inicializarDashboardConRango(inicio: string, fin: string): void {
    this.filtrosActivos = {
      ...this.filtrosActivos,
      fechaInicio: inicio,
      fechaFin: fin,
    };

    this.cargarOpcionesFiltros();

    // Forzar recarga de la vista de ventas tras inicializar filtros
    // Pequeño delay para asegurar que otras inicializaciones async terminen
    setTimeout(() => {
      console.debug(
        '[Dashboard] Forzando reloadView inicial tras inicializar filtros',
        this.filtrosActivos,
      );
      this.ventasRef?.reloadView(true);
    }, 150);

    if (this.rolId === 3) {
      this.cargarTotalesVendedor();
    }
  }

  private resolverRangoInicialConDatos(): void {
    const candidatos = Array.from({ length: 7 }, (_, i) => this.getMonthRangeFromOffset(i));

    const intentar = (idx: number): void => {
      if (idx >= candidatos.length) {
        const fallback = candidatos[0] ?? this.getDefaultDateRange();
        this.inicializarDashboardConRango(fallback.inicio, fallback.fin);
        return;
      }

      const rango = candidatos[idx];
      const filtrosPrueba: DashboardFilters = {
        ...this.filtrosActivos,
        fechaInicio: rango.inicio,
        fechaFin: rango.fin,
      };

      const consulta$ =
        this.rolId === 3
          ? this.cumplimientoService.getCumplimientoMesVendedor(filtrosPrueba)
          : this.cumplimientoService.getCumplimientoMesAdmin(filtrosPrueba);

      consulta$.pipe(takeUntil(this.destroy$)).subscribe({
        next: (res: ApiTotalesResponse<DashboardTotalesVendedor>) => {
          const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
          const hayRegistros = detalle.some(
            (row: DashboardTotalesVendedor) =>
              String((row as any)?.codVendedor ?? '').trim() !== 'TOTALES',
          );

          if (hayRegistros) {
            this.inicializarDashboardConRango(rango.inicio, rango.fin);
            return;
          }

          intentar(idx + 1);
        },
        error: () => {
          intentar(idx + 1);
        },
      });
    };

    intentar(0);
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getWeekRange(date: Date): { inicio: string; fin: string } {
    const day = date.getDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { inicio: this.formatDate(monday), fin: this.formatDate(sunday) };
  }

  private getDayRange(date: Date): { inicio: string; fin: string } {
    const formattedDate = this.formatDate(date);
    return { inicio: formattedDate, fin: formattedDate };
  }

  private getMonthRange(date: Date): { inicio: string; fin: string } {
    const inicio = new Date(date.getFullYear(), date.getMonth(), 1);
    const fin = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { inicio: this.formatDate(inicio), fin: this.formatDate(fin) };
  }

  private adjustDateRangeForTipoCuota(
    tipo: TipoCuota,
    pivotDateStr: string,
  ): { inicio: string; fin: string } {
    const pivotDate = new Date(pivotDateStr);
    if (tipo === 'semanal') {
      return this.getWeekRange(pivotDate);
    } else if (tipo === 'diaria') {
      return this.getDayRange(pivotDate);
    } else {
      return this.getMonthRange(pivotDate);
    }
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  onCambiarTipoCuota(tipo: TipoCuota): void {
    if (this.tipoCuota === tipo) return;
    this.tipoCuota = tipo;

    if (this.rolId === 3) {
      // Auto-ajusta fechas según el nuevo tipoCuota
      const pivotDate = this.filtrosActivos.fechaInicio || this.formatDate(new Date());
      const newRange = this.adjustDateRangeForTipoCuota(tipo, pivotDate);
      this.filtrosActivos.fechaInicio = newRange.inicio;
      this.filtrosActivos.fechaFin = newRange.fin;

      this.totalesVendedor = null;
      this.cargarTotalesVendedor();
      this.ventasRef?.reloadView(true);
    }
  }

  onToggleSidebar(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9\s.,-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private esCiudadResumen(valor: unknown): boolean {
    const ciudad = this.normalizarTexto(valor);
    return ciudad === 'total' || ciudad === 'totales' || ciudad === 'todas' || ciudad === 'todos';
  }

  private toFilterOptions(values: string[]): FilterOption[] {
    return Array.from(new Set(values.filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((value) => ({ label: value, value }));
  }

  private limpiarNombreCategoria(valor: unknown): string {
    let nombre = String(valor ?? '').trim();
    if (!nombre) return '';

    // Quita prefijos tipo: "0001 -" y "1000-" para mostrar solo el nombre.
    nombre = nombre.replace(/^\d+\s*-\s*/u, '');
    nombre = nombre.replace(/^\d+\s*-\s*/u, '');

    return nombre.trim();
  }

  private repararTextoCiudad(valor: unknown): string {
    const txt = String(valor ?? '').trim();
    if (!txt) return '';

    return txt.replace(/◊/g, 'ñ').replace(/Ø/g, 'Ñ').replace(/\s+/g, ' ').trim();
  }

  private normalizarCodVendedor(valor: unknown): string {
    return this.normalizarCodigoVendedor(valor);
  }

  private obtenerCodigoRow(vendedor: ApiVendedorRow): string {
    return this.normalizarCodigoVendedor(
      vendedor.codigo_vendedor ?? vendedor.codVendedor ?? vendedor.codigo ?? vendedor.cod ?? '',
    );
  }

  private obtenerNombreVendedorRow(vendedor: ApiVendedorRow): string {
    return String(vendedor.nombre ?? vendedor.nom_vendedor ?? vendedor.nomVendedor ?? '').trim();
  }

  private construirOpcionesVendedores(vendedores: ApiVendedorRow[]): FilterOption[] {
    const mapa = new Map<string, FilterOption>();

    for (const item of Array.isArray(vendedores) ? vendedores : []) {
      const codigo = this.obtenerCodigoRow(item);
      const nombre = this.obtenerNombreVendedorRow(item);

      if (!codigo || !nombre) continue;

      mapa.set(codigo, {
        label: `${codigo} - ${nombre}`,
        value: codigo,
      });
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }

  private aplicarOpcionesVendedores(opciones: FilterOption[]): void {
    this.vendedorMap.clear();
    this.vendedoresList = opciones;

    this.vendedoresList.forEach((opt) => {
      this.vendedorMap.set(opt.label, opt.value);
      this.vendedorMap.set(opt.value, opt.value);
    });
  }

  private cargarVendedoresFiltrosGlobal(): void {
    this.cumplimientoService
      .getVendedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiVendedorRow[]) => {
        const opciones = this.construirOpcionesVendedores(res);

        if (opciones.length > 0) {
          this.aplicarOpcionesVendedores(opciones);
          return;
        }

        this.usuariosService
          .listarDetalleVendedores()
          .pipe(takeUntil(this.destroy$))
          .subscribe((fallback: ApiVendedorRow[]) => {
            this.aplicarOpcionesVendedores(this.construirOpcionesVendedores(fallback));
          });
      });
  }

  private obtenerCiudadCodigo(item: ApiCiudadRow): string {
    return String(
      item.id_ciudad ?? item.idCiudad ?? item.codCiudad ?? item.codigo ?? item.cod ?? '',
    ).trim();
  }

  private obtenerNombreCategoria(item: ApiCategoriaRow): string {
    return String(item.categoria ?? item.nomCategoria ?? item.nombreCategoria ?? '').trim();
  }

  private obtenerProveedorLabel(item: ApiProveedorRow): string {
    return String(item.nombre ?? '').trim();
  }

  private registrarCiudad(
    nombreCiudad: unknown,
    codigoCiudad: unknown,
    setCiudades: Set<string>,
  ): void {
    const ciudadOriginal = this.repararTextoCiudad(nombreCiudad);
    const ciudadNormalizada = this.normalizarTexto(ciudadOriginal);
    const codigo = String(codigoCiudad ?? '').trim();

    if (!ciudadOriginal || !ciudadNormalizada) return;
    if (this.esCiudadResumen(ciudadOriginal)) return;

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
      .subscribe((vendedores: ApiVendedorRow[]) => {
        const codigos = vendedores.map((v) => this.obtenerCodigoRow(v)).filter((c: string) => !!c);

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
            ciudades: this.cumplimientoService
              .getCiudadesPorVendedor(codigo)
              .pipe(catchError(() => of({ detallePorCiudad: [] } as ApiCiudadesResponse))),
            lineas: this.cumplimientoService
              .getLineasPorVendedor(codigo)
              .pipe(catchError(() => of({ detallePorLinea: [] } as ApiLineasResponse))),
          }),
        );

        forkJoin(peticiones)
          .pipe(takeUntil(this.destroy$))
          .subscribe(
            (resultados: Array<{ ciudades: ApiCiudadesResponse; lineas: ApiLineasResponse }>) => {
              const ciudadesUnicas = new Set<string>();
              const lineasUnicas = new Set<string>();

              resultados.forEach((resultado) => {
                const ciudades = resultado?.ciudades?.detallePorCiudad ?? [];
                const lineas = resultado?.lineas?.detallePorLinea ?? [];

                ciudades.forEach((item: ApiCiudadRow) => {
                  this.registrarCiudad(
                    item?.ciudad,
                    this.obtenerCiudadCodigo(item),
                    ciudadesUnicas,
                  );
                });

                lineas.forEach((item: ApiLineaRow) => {
                  const linea = String(item?.linea ?? '').trim();
                  const cod = String(item?.codigoLinea ?? '').trim();
                  if (!linea) return;

                  if (cod) {
                    this.lineaMap.set(linea, cod);
                  }
                  lineasUnicas.add(linea);
                });
              });

              this.ciudadesList = this.toFilterOptions(Array.from(ciudadesUnicas));
              this.lineasList = this.toFilterOptions(Array.from(lineasUnicas));
            },
          );
      });
  }

  private cargarOpcionesVendedor(filtros?: DashboardFilters): void {
    const codigo = this.codigoVendedor;
    if (!codigo) {
      this.ciudadesList = [];
      this.lineasList = [];
      this.ciudadMap.clear();
      this.lineaMap.clear();
      return;
    }

    const filtrosBase: DashboardFilters = { ...(filtros ?? this.filtrosActivos) };
    const rangoActual = this.getDefaultDateRange();

    if (
      !String(filtrosBase.fechaInicio ?? '').trim() ||
      !String(filtrosBase.fechaFin ?? '').trim()
    ) {
      filtrosBase.fechaInicio = rangoActual.inicio;
      filtrosBase.fechaFin = rangoActual.fin;
    }

    const fechaInicio = String(filtrosBase.fechaInicio ?? '').trim();
    const fechaFin = String(filtrosBase.fechaFin ?? '').trim();

    const usarFallbackMesAnterior =
      !!fechaInicio &&
      !!fechaFin &&
      fechaInicio === rangoActual.inicio &&
      fechaFin === rangoActual.fin;

    const construirCandidatosMeses = (): DashboardFilters[] => {
      const candidatos: DashboardFilters[] = [filtrosBase];

      if (!usarFallbackMesAnterior) {
        return candidatos;
      }

      const hoy = new Date();
      for (let i = 1; i <= 6; i += 1) {
        candidatos.push({
          ...filtrosBase,
          fechaInicio: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)),
          fechaFin: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0)),
        });
      }

      return candidatos;
    };

    const cargarLineas = (filtrosLineas: DashboardFilters): void => {
      this.cumplimientoService
        .getLineasPorVendedor(codigo, filtrosLineas)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado: ApiLineaRow[] = res?.detallePorLinea ?? [];
          this.lineaMap.clear();

          const unicos = new Set<string>();
          listado.forEach((item) => {
            const linea = String(item?.linea ?? '').trim();
            const codigoLinea = String(item?.codigoLinea ?? '').trim();

            if (linea) {
              if (codigoLinea) this.lineaMap.set(linea, codigoLinea);
              unicos.add(linea);
            }
          });

          this.lineasList = this.toFilterOptions(Array.from(unicos));
        });
    };

    const candidatosMeses = construirCandidatosMeses();

    const cargarCiudades = (indiceCandidato = 0): void => {
      const filtrosCiudades = candidatosMeses[indiceCandidato];

      this.cumplimientoService
        .getCiudadesPorVendedor(codigo, filtrosCiudades)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado: ApiCiudadRow[] = res?.detallePorCiudad ?? [];

          if (!listado.length && indiceCandidato < candidatosMeses.length - 1) {
            cargarLineas(candidatosMeses[indiceCandidato + 1]);
            cargarCiudades(indiceCandidato + 1);
            return;
          }

          this.ciudadMap.clear();

          const unicos = new Set<string>();
          listado.forEach((item) => {
            this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), unicos);
          });

          this.ciudadesList = this.toFilterOptions(Array.from(unicos));
        });
    };

    cargarLineas(filtrosBase);
    cargarCiudades(0);
  }

  private cargarCiudadesYLineasAdmin(): void {
    const filtrosBase: DashboardFilters = {
      ...this.filtrosActivos,
      vendedor: '',
      categoria: '',
      ciudad: '',
      ciudadNombre: '',
      linea: '',
    };

    this.ciudadMap.clear();
    this.lineaMap.clear();

    this.cumplimientoService
      .getCiudadesGlobal(filtrosBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: any) => {
        const ciudadesDetalle: ApiCiudadRow[] = Array.isArray(res?.detallePorCiudad)
          ? res.detallePorCiudad
          : [];

        const ciudades = new Set<string>();
        ciudadesDetalle.forEach((item) => {
          this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), ciudades);
        });

        this.ciudadesList = this.toFilterOptions(Array.from(ciudades));
      });

    this.cumplimientoService
      .getCumplimientoMesAdmin(filtrosBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiTotalesResponse<CumplimientoAdminDetalleRow>) => {
        const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
        const lineas = new Set<string>();

        detalle.forEach((row) => {
          const linea = String(row?.linea ?? row?.nomLinea ?? row?.nombreLinea ?? '').trim();
          if (linea) {
            lineas.add(linea);
          }
        });

        this.lineasList = this.toFilterOptions(Array.from(lineas));
      });
  }

  private resolverCodigoVendedorDesdeApi(): void {
    if (this.codigoVendedor) return;

    this.cumplimientoService
      .getCumplimientoMesVendedor(this.filtrosActivos)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiTotalesResponse<DashboardTotalesVendedor>) => {
        const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
        const fila = detalle.find((item) => String(item?.codVendedor ?? '').trim() !== 'TOTALES');
        const codigo = this.normalizarCodigoVendedor(fila?.codVendedor ?? '');

        if (!codigo) return;

        this.codigoVendedorDetectado = codigo;
        this.cargarOpcionesVendedor(this.filtrosActivos);
        this.cargarCategoriasFiltros();
      });
  }

  logout(): void {
    this.authService.logout();
  }

  cargarOpcionesFiltros(): void {
    this.cargarCategoriasFiltros();

    this.cumplimientoService
      .getProveedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((proveedores: ApiProveedorRow[]) => {
        this.proveedorMap.clear();
        const unicos = new Set<string>();

        proveedores.forEach((item) => {
          const nombre = this.obtenerProveedorLabel(item);
          const codigo = String(item.codigo ?? '').trim();

          if (nombre && codigo) {
            this.proveedorMap.set(nombre, codigo);
            unicos.add(nombre);
          }
        });

        this.proveedoresList = this.toFilterOptions(Array.from(unicos));
      });

    if (this.esAdmin) {
      this.cargarVendedoresFiltrosGlobal();
    } else if (this.esSupervisor) {
      this.cargarVendedoresSupervisor();
    }

    if (this.esAdmin) {
      this.cargarCiudadesYLineasAdmin();
    }

    if (!this.esAdmin && this.codigoVendedor) {
      this.cargarOpcionesVendedor(this.filtrosActivos);
      this.cargarCategoriasFiltros();
    } else if (!this.esAdmin) {
      this.resolverCodigoVendedorDesdeApi();
    }

    if (this.esSupervisor) {
      this.cargarCiudadesYLineasSupervisor();
    }
  }

  private cargarVendedoresSupervisor(): void {
    const idSupervisor = String(
      this.vendedor?.id_usuario ?? this.vendedor?.idUsuario ?? this.vendedor?.id ?? '',
    );

    if (!idSupervisor) {
      this.vendedoresList = [];
      return;
    }

    this.usuariosService
      .obtenerVendedoresDelSupervisor(idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendedores: ApiVendedorRow[]) => {
        this.vendedorMap.clear();
        this.vendedoresList = this.construirOpcionesVendedores(vendedores);

        this.vendedoresList.forEach((opt) => {
          this.vendedorMap.set(opt.label, opt.value);
          this.vendedorMap.set(opt.value, opt.value);
        });
      });
  }

  private cargarCategoriasFiltros(): void {
    if (this.esAdmin) {
      this.cumplimientoService
        .getCuotaCategoriasPorVendedores()
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: ApiTotalesResponse<ApiCategoriaRow>) => {
          const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
          const unicas = new Map<string, string>();

          detalle.forEach((item) => {
            const categoriaRaw = this.obtenerNombreCategoria(item);

            if (!categoriaRaw) return;

            const categoriaLimpia = this.limpiarNombreCategoria(categoriaRaw);
            if (!categoriaLimpia) return;

            if (!unicas.has(categoriaLimpia)) {
              unicas.set(categoriaLimpia, categoriaRaw);
            }
          });

          this.categoriasList = Array.from(unicas.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es'));
        });

      return;
    }

    const filtrosBase: DashboardFilters = {
      ...this.filtrosActivos,
      vendedor: this.filtrosActivos.vendedor,
      proveedor: this.filtrosActivos.proveedor,
      fechaInicio: '',
      fechaFin: '',
      categoria: '',
      categoriaNombre: '',
      categorias: [],
      linea: '',
    };

    const hoy = new Date();
    const candidatos: DashboardFilters[] = [filtrosBase];

    for (let i = 0; i <= 6; i += 1) {
      candidatos.push({
        ...filtrosBase,
        fechaInicio: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)),
        fechaFin: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0)),
      });
    }

    const intentarCategorias = (idx: number): void => {
      const filtrosConsulta = candidatos[idx];
      // Usar getCuotaCategoriaGeneral para obtener todas las categorías con filtros (vendedor, proveedor, fecha)
      const categorias$ = this.cumplimientoService.getCuotaCategoriaGeneral(filtrosConsulta);

      categorias$
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: ApiTotalesResponse<ApiCategoriaRow>) => {
          const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
          const unicas = new Map<string, string>();

          detalle.forEach((item) => {
            const categoriaRaw = this.obtenerNombreCategoria(item);

            if (!categoriaRaw) return;

            const categoriaLimpia = this.limpiarNombreCategoria(categoriaRaw);
            if (!categoriaLimpia) return;

            if (!unicas.has(categoriaLimpia)) {
              unicas.set(categoriaLimpia, categoriaRaw);
            }
          });

          if (unicas.size === 0 && idx < candidatos.length - 1) {
            intentarCategorias(idx + 1);
            return;
          }

          this.categoriasList = Array.from(unicas.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es'));
        });
    };

    intentarCategorias(0);
  }

  onVendedorChange(vendedor: string): void {
    const filtros: DashboardFilters = {
      ...this.filtrosActivos,
      vendedor: String(vendedor ?? '').trim(),
    };

    this.onAplicarFiltros(filtros);
  }

  onProveedorChange(proveedor: string): void {
    const filtros: DashboardFilters = {
      ...this.filtrosActivos,
      proveedor: String(proveedor ?? '').trim(),
      categoria: '',
      categoriaNombre: '',
      categorias: [],
      categoriaNombres: [],
    };

    this.onAplicarFiltros(filtros);
  }

  onAplicarFiltros(filtros: DashboardFilters): void {
    const rangoDefault = this.getDefaultDateRange();
    const fechaInicio = String(filtros.fechaInicio ?? '').trim() || rangoDefault.inicio;
    const fechaFin = String(filtros.fechaFin ?? '').trim() || rangoDefault.fin;

    let ciudadVisible = String(filtros.ciudad ?? '').trim();
    if (this.esCiudadResumen(ciudadVisible)) {
      ciudadVisible = '';
    }

    const ciudadNormalizada = this.normalizarTexto(ciudadVisible);

    const filtrosConCodigos: DashboardFilters = {
      fechaInicio,
      fechaFin,
      vendedor: '',
      proveedor: '',
      categoria: filtros.categoria || '',
      categoriaNombre: filtros.categoriaNombre || '',
      categorias: filtros.categorias ?? [],
      categoriaNombres: filtros.categoriaNombres ?? [],
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
        this.ciudadMap.get(ciudadVisible) ?? this.ciudadMap.get(ciudadNormalizada) ?? ciudadVisible;
    }

    if (filtros.linea) {
      filtrosConCodigos.linea = this.lineaMap.get(filtros.linea) ?? filtros.linea;
    }

    this.filtrosActivos = { ...filtrosConCodigos };

    // Refresca catálogo de categorías para el rango/proveedor actual.
    this.cargarCategoriasFiltros();

    if (!this.esAdmin) {
      // El catálogo de ciudades debe mantenerse completo: no recargarlo filtrado por ciudad seleccionada.
      this.cargarOpcionesVendedor({ ...this.filtrosActivos, ciudad: '', ciudadNombre: '' });
    }

    // Auto-ajusta fechas si estamos en modo semanal o diaria
    if (this.rolId === 3 && this.tipoCuota !== 'mensual') {
      const newRange = this.adjustDateRangeForTipoCuota(
        this.tipoCuota,
        this.filtrosActivos.fechaInicio,
      );
      this.filtrosActivos.fechaInicio = newRange.inicio;
      this.filtrosActivos.fechaFin = newRange.fin;
    }

    if (this.rolId === 3) {
      this.cargarTotalesVendedor();
      // No llamar a ventasRef?.reloadView() aquí - el setter de @Input filtros
      // dispara automáticamente solicitarCargaVista() cuando filtrosActivos cambia
    }

    // Forzar recarga de la vista de ventas después de aplicar los filtros
    this.ventasRef?.reloadView(true);
  }

  private cargarTotalesVendedor(): void {
    const filtros = { ...this.filtrosActivos };

    const obs$ =
      this.tipoCuota === 'mensual'
        ? this.cumplimientoService.getCumplimientoMesVendedor(filtros)
        : this.semanaService.getCumplimientoSemanaVendedor(filtros);

    const campo =
      this.tipoCuota === 'semanal'
        ? 'cuotaSemana'
        : this.tipoCuota === 'diaria'
          ? 'cuotaDiaria'
          : 'cuotaMes';

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiTotalesResponse<DashboardTotalesVendedor>) => {
        const detalle = (res?.detalle ?? []).filter((v) => v.codVendedor !== 'TOTALES');
        const d = detalle[0];

        if (!d) {
          this.totalesVendedor = null;
          return;
        }

        const raw = d as Record<string, unknown>;
        const leerNumero = (...valores: unknown[]): number => {
          for (const valor of valores) {
            const numero = Number(valor ?? 0);
            if (Number.isFinite(numero)) return numero;
          }
          return 0;
        };

        // Normalize possible field names and fill all cuota variants so template bindings work.
        const cuotaMesVal = leerNumero(raw['cuotaMes'], raw['cuota_mes']);
        const cuotaSemanaVal = leerNumero(
          raw['cuotaSemana'],
          raw['cuota_semana'],
          this.tipoCuota === 'semanal' ? raw[campo] : undefined,
        );
        const cuotaDiariaVal = leerNumero(
          raw['cuotaDiaria'],
          raw['cuotaDia'],
          raw['cuota_dia'],
          this.tipoCuota === 'diaria' ? raw[campo] : undefined,
        );

        this.totalesVendedor = {
          ventaAcum: Number(d.ventaAcum ?? 0) || 0,
          cuotaMes:
            cuotaMesVal || (this.tipoCuota === 'mensual' ? Number(d[campo] ?? 0) : cuotaMesVal),
          cuotaSemana:
            cuotaSemanaVal ||
            (this.tipoCuota === 'semanal' ? Number(d[campo] ?? 0) : cuotaSemanaVal),
          cuotaDiaria:
            cuotaDiariaVal ||
            (this.tipoCuota === 'diaria' ? Number(d[campo] ?? 0) : cuotaDiariaVal),
          porcCump: Number(d.porcCump ?? 0) || 0,
          proyeccionVenta: Number(d.proyeccionVenta ?? 0) || 0,
        };
      },
      error: () => {
        this.totalesVendedor = null;
      },
    });
  }
}
