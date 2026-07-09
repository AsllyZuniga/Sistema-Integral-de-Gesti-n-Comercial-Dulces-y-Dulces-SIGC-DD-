import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SessionUser } from '../../core/services/session.service';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../core/services/ventas/cumplimientoVentasSemana.service';
import { CuotaDiaService, CuotaDiaVendedor } from '../../core/services/ventas/cuotaDia.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { FiltrosService } from '../../core/services/ventas/filtros.service';
import {
  FiltersComponent,
  DashboardFilters,
} from '../../shared/components/filters/filters.component';
import { FilterOption } from '../../shared/components/filters/filters.component';
import { enriquecerOpcionesSinDuplicadosVisuales } from '../../shared/utils/filter-options.util';
import { normalizarTextoFiltro } from '../../shared/utils/text-normalization.util';
import { repararNombreMunicipio } from '../../shared/utils/narino-municipios.util';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
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
  ventaDiaria?: number;
  cuotaMes?: number;
  cuotaDiaria?: number;
  cuotaDia?: number;
  cuotaSemana?: number;
  porcCump?: number;
  proyeccionVenta?: number;
  promedioDiario?: number;
  codVendedor?: string;
}

interface ApiProveedorRow {
  nombre?: string;
  nombreProveedor?: string;
  nomProveedor?: string;
  nombre_proveedor?: string;
  proveedor?: string;

  codigo?: string;
  codigoProveedor?: string;
  cod?: string;
  idProveedor?: string | number;
  id_proveedor?: string | number;
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
    TopbarComponent,
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
    private cuotaDiaService: CuotaDiaService,
    private filtrosService: FiltrosService,
    private usuariosService: UsuariosService,
    private proveedorService: ProveedorService,
    private cdr: ChangeDetectorRef,
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
  private codigosVendedoresSupervisor: string[] = [];

  private destroy$ = new Subject<void>();
  private codigoVendedorDetectado = '';

  private respuestaCumplimientoOriginal: any = null;
  private cacheCumplimientoClave: string = '';
  private categoriasRequestId = 0;

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

  /**
   * El filtro por vendedor se muestra únicamente para ADMINISTRADOR y SUPERVISOR.
   * VENDEDOR no lo ve porque el backend restringe sus datos desde el token.
   */
  get mostrarFiltroVendedorPorRol(): boolean {
    return this.esAdmin || this.esSupervisor;
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
    this.filtrosPendientes = { ...this.filtrosActivos };

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
    // OPTIMIZACION: cachear el rango resuelto por sesion (localStorage).
    // Asi no repetimos hasta 7 llamadas HTTP cada vez que el usuario
    // navega a /dashboard o recarga la pagina.
    const CACHE_KEY = 'sigc_dd_rango_inicial';
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { inicio: string; fin: string };
        if (parsed?.inicio && parsed?.fin) {
          this.inicializarDashboardConRango(parsed.inicio, parsed.fin);
          return;
        }
      }
    } catch {
      // ignore
    }

    const candidatos = Array.from({ length: 7 }, (_, i) => this.getMonthRangeFromOffset(i));

    const intentar = (idx: number): void => {
      if (idx >= candidatos.length) {
        const fallback = candidatos[0] ?? this.getDefaultDateRange();
        this.guardarRangoInicialCache(fallback.inicio, fallback.fin, CACHE_KEY);
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
            this.guardarRangoInicialCache(rango.inicio, rango.fin, CACHE_KEY);
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

  private guardarRangoInicialCache(inicio: string, fin: string, key: string): void {
    try {
      window.localStorage.setItem(key, JSON.stringify({ inicio, fin }));
    } catch {
      // ignore
    }
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

    const saneado = normalizarTextoFiltro(
      txt.replace(/◊/g, 'ñ').replace(/Ø/g, 'Ñ'),
    );

    return repararNombreMunicipio(saneado);
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
    let nombre = String(vendedor.nombre ?? vendedor.nom_vendedor ?? vendedor.nomVendedor ?? '').trim();
    nombre = nombre.replace(/^\d+\s*-\s*/u, '').trim();
    return nombre;
  }

  private construirOpcionesVendedores(vendedores: ApiVendedorRow[]): FilterOption[] {
    const mapa = new Map<string, FilterOption>();

    for (const item of Array.isArray(vendedores) ? vendedores : []) {
      const codigo = this.obtenerCodigoRow(item);
      const nombre = this.obtenerNombreVendedorRow(item);

      if (!codigo || !nombre) continue;

      mapa.set(codigo, {
        label: `${codigo} ${nombre}`,
        value: codigo,
      });
    }

    return Array.from(mapa.values()).sort(
      (a, b) => Number(a.value) - Number(b.value),
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

  private ordenarVendedoresPorCodigo(opciones: FilterOption[]): FilterOption[] {
    return [...opciones].sort((a, b) => Number(a.value) - Number(b.value));
  }


  private aplicarOpcionesCiudades(opciones: FilterOption[]): void {
    const mapa = new Map<string, FilterOption>();
    this.ciudadMap.clear();

    const normalizar = (valor: unknown): string => String(valor ?? '').trim();

    for (const opcion of Array.isArray(opciones) ? opciones : []) {
      const value = normalizarTextoFiltro(opcion?.value);
      const label = this.repararTextoCiudad(opcion?.label || value);
      if (!value || !label || this.esCiudadResumen(label)) continue;

      if (!mapa.has(value)) {
        mapa.set(value, { value, label });
      }

      // Permite aplicar por código, por nombre visible o por nombre normalizado.
      this.ciudadMap.set(value, value);
      this.ciudadMap.set(label, value);
      this.ciudadMap.set(this.normalizarTexto(label), value);
    }

    this.ciudadesList = enriquecerOpcionesSinDuplicadosVisuales(
      Array.from(mapa.values()),
    );
  }

  private construirOpcionesCiudadesDesdeDetalle(detalle: any[]): FilterOption[] {
    const mapa = new Map<string, FilterOption>();

    for (const row of Array.isArray(detalle) ? detalle : []) {
      const label = this.repararTextoCiudad(row?.ciudad ?? row?.nomCiudad ?? row?.nombreCiudad ?? '');
      const value = normalizarTextoFiltro(
        String(
          row?.id_ciudad ?? row?.idCiudad ?? row?.codCiudad ?? row?.codigoCiudad ?? row?.codigo ?? row?.cod ?? label,
        ).trim(),
      );

      if (!label || this.esCiudadResumen(label) || !value) continue;
      if (!mapa.has(value)) mapa.set(value, { value, label });
    }

    return enriquecerOpcionesSinDuplicadosVisuales(Array.from(mapa.values()));
  }

  private cargarCiudadesFallback(filtros: DashboardFilters): void {
    this.cumplimientoService
      .getCiudadesGlobal(filtros)
      .pipe(takeUntil(this.destroy$), catchError(() => of({ detallePorCiudad: [] })))
      .subscribe((res: any) => {
        const opciones = this.construirOpcionesCiudadesDesdeDetalle(res?.detallePorCiudad ?? []);
        this.aplicarOpcionesCiudades(
          this.conservarOpcionesSeleccionadas(
            opciones,
            this.normalizarArrayFiltro(filtros.ciudades, filtros.ciudad),
            filtros.ciudadesNombres,
          ),
        );
        this.cdr.markForCheck();
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
    return String(
      item?.nombre ??
        item?.nombreProveedor ??
        item?.nomProveedor ??
        item?.nombre_proveedor ??
        item?.proveedor ??
        '',
    ).trim();
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

  private crearFiltrosCatalogo(options: {
    conservarProveedor?: boolean;
    conservarVendedor?: boolean;
    conservarCategoria?: boolean;
  } = {}): DashboardFilters {
    return {
      ...this.filtrosActivos,
      vendedor: options.conservarVendedor ? this.filtrosActivos.vendedor : '',
      proveedor: options.conservarProveedor ? this.filtrosActivos.proveedor : '',
      proveedores: options.conservarProveedor ? (this.filtrosActivos.proveedores ?? []) : [],
      proveedorNombre: options.conservarProveedor ? this.filtrosActivos.proveedorNombre : '',
      proveedorNombres: options.conservarProveedor ? (this.filtrosActivos.proveedorNombres ?? []) : [],
      categoria: options.conservarCategoria ? this.filtrosActivos.categoria : '',
      categoriaNombre: options.conservarCategoria ? this.filtrosActivos.categoriaNombre : '',
      categorias: options.conservarCategoria ? (this.filtrosActivos.categorias ?? []) : [],
      categoriaNombres: options.conservarCategoria ? (this.filtrosActivos.categoriaNombres ?? []) : [],
      ciudad: '',
      ciudadNombre: '',
      linea: '',
    };
  }

  private obtenerCodigoProveedorLinea(item: ApiLineaRow | any): string {
    // idProveedor/id_proveedor es el id numérico real de la tabla
    // `proveedor`, el único valor que el backend acepta en el filtro
    // (`it.id_proveedor IN (...)`). codigoLinea/codigo_linea NO es un
    // código: el backend lo llena con el nombre completo del proveedor
    // ("1200 - ALDOR"), así que priorizarlo mandaba ese texto como value
    // del filtro y el backend nunca matcheaba (0 resultados).
    const codigo = String(
      item?.idProveedor ??
        item?.id_proveedor ??
        item?.codigoProveedor ??
        item?.codigo ??
        item?.cod ??
        '',
    ).trim();

    if (codigo) return codigo;

    const linea = String(item?.linea ?? item?.reporteProvConObs ?? '').trim();
    return linea.match(/^\s*(\d+)/)?.[1] ?? linea;
  }

  private obtenerNombreProveedorLinea(item: ApiLineaRow | any): string {
    return this.repararTextoCiudad(
      String(
        item?.linea ??
          item?.reporteProvConObs ??
          item?.nombreProveedor ??
          item?.nomProveedor ??
          item?.proveedor ??
          item?.nombre ??
          '',
      ).trim(),
    );
  }

  private aplicarOpcionesProveedores(opciones: FilterOption[]): void {
    this.proveedorMap.clear();
    this.proveedoresList = opciones;

    opciones.forEach((opcion) => {
      this.proveedorMap.set(opcion.label, opcion.value);
      this.proveedorMap.set(opcion.value, opcion.value);
    });
  }

  private construirOpcionesProveedoresDesdeLineas(lineas: any[]): FilterOption[] {
    const mapa = new Map<string, FilterOption>();

    (Array.isArray(lineas) ? lineas : []).forEach((item) => {
      const label = normalizarTextoFiltro(this.obtenerNombreProveedorLinea(item));
      const value = normalizarTextoFiltro(this.obtenerCodigoProveedorLinea(item));
      if (!label && !value) return;

      const opcion: FilterOption = {
        label: label || value,
        value: value || label,
      };

      const key = opcion.value || opcion.label;
      if (!mapa.has(key)) {
        mapa.set(key, opcion);
      }
    });

    return enriquecerOpcionesSinDuplicadosVisuales(Array.from(mapa.values()));
  }

  private construirOpcionesCategorias(detalle: ApiCategoriaRow[]): FilterOption[] {
    const unicas = new Map<string, FilterOption>();

    (Array.isArray(detalle) ? detalle : []).forEach((item) => {
      const categoriaRaw = this.obtenerNombreCategoria(item);
      if (!categoriaRaw) return;

      const categoriaNormalizada = normalizarTextoFiltro(categoriaRaw);
      if (!categoriaNormalizada) return;

      const categoriaLimpia = this.limpiarNombreCategoria(categoriaNormalizada);
      if (!categoriaLimpia) return;

      const codigo = normalizarTextoFiltro(
        String(
          item.id_categoria ?? item.idCategoria ?? item.categoria_id ?? '',
        ).trim(),
      );

      // Dedup por código (no por label) para que dos categorías distintas
      // con el mismo nombre no se colapsen en una sola entrada.
      const value = codigo || categoriaLimpia;
      if (unicas.has(value)) return;

      unicas.set(value, { value, label: categoriaLimpia });
    });

    return enriquecerOpcionesSinDuplicadosVisuales(Array.from(unicas.values()));
  }

  private obtenerIdSupervisorActual(): string {
    return String(
      this.vendedor?.id_usuario ?? this.vendedor?.idUsuario ?? this.vendedor?.id ?? '',
    ).trim();
  }

  private obtenerCodigosSupervisor(callback: (codigos: string[]) => void): void {
    if (this.codigosVendedoresSupervisor.length) {
      callback([...this.codigosVendedoresSupervisor]);
      return;
    }

    const idSupervisor = this.obtenerIdSupervisorActual();
    if (!idSupervisor) {
      callback([]);
      return;
    }

    this.usuariosService
      .obtenerVendedoresDelSupervisor(idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendedores: ApiVendedorRow[]) => {
        this.codigosVendedoresSupervisor = vendedores
          .map((v) => this.obtenerCodigoRow(v))
          .filter((codigo) => !!codigo);
        callback([...this.codigosVendedoresSupervisor]);
      });
  }

  private codigosParaCatalogosPorRol(callback: (codigos: string[]) => void): void {
    const vendedorFiltro = String(this.filtrosActivos.vendedor ?? '').trim();

    if (vendedorFiltro) {
      callback([vendedorFiltro]);
      return;
    }

    if (this.esSupervisor) {
      this.obtenerCodigosSupervisor(callback);
      return;
    }

    if (this.rolId === 3) {
      callback(this.codigoVendedor ? [this.codigoVendedor] : []);
      return;
    }

    callback([]);
  }

  private cargarProveedoresFiltros(): void {
    const filtrosCatalogo = this.crearFiltrosCatalogo({ conservarVendedor: true });

    // Microtarea B1: 1 sola llamada al endpoint role-aware /api/mes/cumplimiento/lineas.
    // El backend filtra por scope JWT: admin ve todo, supervisor ve su
    // equipo, vendedor ve solo lo suyo. Se eliminó la N+1 que iteraba
    // per-vendor con forkJoin.
    this.cumplimientoService
      .getLineasAdmin(filtrosCatalogo)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiLineasResponse) => {
        this.aplicarOpcionesProveedores(
          this.construirOpcionesProveedoresDesdeLineas(res?.detallePorLinea ?? []),
        );
      });
  }


  /**
   * Carga inicial de catalogos del supervisor (ciudades/lineas) - solo 1 vez.
   * Si la cache ya esta cargada para las fechas actuales, no hace nada.
   */
  private catalogosSupervisorCargadosKey = '';
  private cargarCatalogosSupervisorLazy(): void {
    const key = `${this.filtrosActivos?.fechaInicio ?? ''}|${this.filtrosActivos?.fechaFin ?? ''}`;
    if (this.catalogosSupervisorCargadosKey === key) return;
    this.catalogosSupervisorCargadosKey = key;

    this.cargarCiudadesYLineasSupervisor();
  }

  private cargarCiudadesYLineasSupervisor(): void {
    const filtrosCatalogo = this.crearFiltrosCatalogo({ conservarProveedor: true, conservarVendedor: true });

    // Microtarea B2: 2 llamadas a endpoints role-aware (1 ciudades + 1 lineas).
    // El backend filtra por scope JWT: admin ve todo, supervisor ve su
    // equipo, vendedor ve solo lo suyo. Antes: 2N llamadas per-vendor.
    this.ciudadMap.clear();
    this.lineaMap.clear();

    forkJoin({
      ciudades: this.cumplimientoService
        .getCiudadesGlobal(filtrosCatalogo)
        .pipe(catchError(() => of({ detallePorCiudad: [] } as ApiCiudadesResponse))),
      lineas: this.cumplimientoService
        .getLineasAdmin(filtrosCatalogo)
        .pipe(catchError(() => of({ detallePorLinea: [] } as ApiLineasResponse))),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe((resultado: { ciudades: ApiCiudadesResponse; lineas: ApiLineasResponse }) => {
        const ciudadesUnicas = new Set<string>();
        const lineasUnicas = new Set<string>();

        const ciudades = resultado?.ciudades?.detallePorCiudad ?? [];
        const lineas = resultado?.lineas?.detallePorLinea ?? [];

        ciudades.forEach((item: ApiCiudadRow) => {
          this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), ciudadesUnicas);
        });

        lineas.forEach((item: ApiLineaRow) => {
          const linea = this.obtenerNombreProveedorLinea(item);
          const cod = this.obtenerCodigoProveedorLinea(item);
          if (!linea) return;

          if (cod) this.lineaMap.set(linea, cod);
          lineasUnicas.add(linea);
        });

        this.aplicarOpcionesCiudades(this.toFilterOptions(Array.from(ciudadesUnicas)));
        this.lineasList = this.toFilterOptions(Array.from(lineasUnicas));
      });
  }

  private cargarOpcionesVendedor(filtros?: DashboardFilters): void {
    const codigo = this.codigoVendedor;
    if (!codigo) {
      this.ciudadesList = [];
      this.lineasList = [];
      this.aplicarOpcionesProveedores([]);
      this.ciudadMap.clear();
      this.lineaMap.clear();
      return;
    }

    const filtrosBase: DashboardFilters = {
      ...(filtros ?? this.filtrosActivos),
      vendedor: '',
      categoria: '',
      categoriaNombre: '',
      categorias: [],
      categoriaNombres: [],
      ciudad: '',
      ciudadNombre: '',
      linea: '',
    };

    const rangoActual = this.getDefaultDateRange();

    if (!String(filtrosBase.fechaInicio ?? '').trim() || !String(filtrosBase.fechaFin ?? '').trim()) {
      filtrosBase.fechaInicio = rangoActual.inicio;
      filtrosBase.fechaFin = rangoActual.fin;
    }

    this.cumplimientoService
      .getLineasPorVendedor(codigo, filtrosBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiLineasResponse) => {
        const listado = res?.detallePorLinea ?? [];
        this.lineaMap.clear();

        const unicos = new Set<string>();
        listado.forEach((item: ApiLineaRow) => {
          const linea = this.obtenerNombreProveedorLinea(item);
          const codigoLinea = this.obtenerCodigoProveedorLinea(item);

          if (linea) {
            if (codigoLinea) this.lineaMap.set(linea, codigoLinea);
            unicos.add(linea);
          }
        });

        this.lineasList = this.toFilterOptions(Array.from(unicos));
        this.aplicarOpcionesProveedores(this.construirOpcionesProveedoresDesdeLineas(listado));
      });

    this.cumplimientoService
      .getCiudadesPorVendedor(codigo, filtrosBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiCiudadesResponse) => {
        const listado = res?.detallePorCiudad ?? [];
        this.ciudadMap.clear();

        const unicos = new Set<string>();
        listado.forEach((item: ApiCiudadRow) => {
          this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), unicos);
        });

        this.aplicarOpcionesCiudades(this.toFilterOptions(Array.from(unicos)));
      });
  }

  private cargarCiudadesYLineasAdmin(): void {
    const filtrosBase = this.crearFiltrosCatalogo({ conservarProveedor: true, conservarVendedor: true });
    const vendedorSeleccionado = String(this.filtrosActivos.vendedor ?? '').trim();

    this.ciudadMap.clear();
    this.lineaMap.clear();

    if (vendedorSeleccionado) {
      forkJoin({
        ciudades: this.cumplimientoService
          .getCiudadesPorVendedor(vendedorSeleccionado, filtrosBase)
          .pipe(catchError(() => of({ detallePorCiudad: [] } as ApiCiudadesResponse))),
        lineas: this.cumplimientoService
          .getLineasPorVendedor(vendedorSeleccionado, filtrosBase)
          .pipe(catchError(() => of({ detallePorLinea: [] } as ApiLineasResponse))),
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe(({ ciudades, lineas }) => {
          const ciudadesSet = new Set<string>();
          (ciudades?.detallePorCiudad ?? []).forEach((item: ApiCiudadRow) => {
            this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), ciudadesSet);
          });

          const lineasSet = new Set<string>();
          (lineas?.detallePorLinea ?? []).forEach((item: ApiLineaRow) => {
            const linea = this.obtenerNombreProveedorLinea(item);
            const codigo = this.obtenerCodigoProveedorLinea(item);
            if (!linea) return;
            if (codigo) this.lineaMap.set(linea, codigo);
            lineasSet.add(linea);
          });

          this.aplicarOpcionesCiudades(this.toFilterOptions(Array.from(ciudadesSet)));
          this.lineasList = this.toFilterOptions(Array.from(lineasSet));
        });
      return;
    }

    this.cumplimientoService
      .getCiudadesGlobal(filtrosBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiCiudadesResponse) => {
        const ciudadesDetalle = Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
        const ciudades = new Set<string>();
        ciudadesDetalle.forEach((item) => {
          this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), ciudades);
        });
        this.aplicarOpcionesCiudades(this.toFilterOptions(Array.from(ciudades)));
      });

    this.cumplimientoService
      .getLineasAdmin(filtrosBase)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ApiLineasResponse) => {
        const detalle = Array.isArray(res?.detallePorLinea) ? res.detallePorLinea : [];
        const lineas = new Set<string>();
        detalle.forEach((row: ApiLineaRow) => {
          const linea = this.obtenerNombreProveedorLinea(row);
          const codigo = this.obtenerCodigoProveedorLinea(row);
          if (!linea) return;
          if (codigo) this.lineaMap.set(linea, codigo);
          lineas.add(linea);
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
    // Cascade unificado: 1 sola llamada a /api/filtros/opciones
    // trae los 4 desplegables (vendedor, proveedor, categoría, ciudad)
    // ya filtrados por rol, rango de fechas y demás filtros aplicados.
    // Para rol vendedor, el endpoint ignora el `vendedores` del query
    // y devuelve solo su propio código; no hace falta
    // `cargarOpcionesVendedor` / `resolverCodigoVendedorDesdeApi` por
    // separado.
    this.cargarOpcionesFiltrosUnificado();
  }

  /**
   * Repobla los 4 desplegables a partir de los filtros actuales.
   * Si se pasa `filtrosOrigen` (caso filterChange) usa ese; si no,
   * usa `filtrosActivos` (caso apply o carga inicial).
   */
  private cargarOpcionesFiltrosUnificado(filtrosOrigen?: DashboardFilters): void {
    const fuente = this.normalizarFiltrosDashboard(filtrosOrigen ?? this.filtrosActivos);

    /*
     * El backend /api/filtros/opciones ya implementa la cascada correcta:
     * cada lista se filtra por los OTROS filtros, no por sí misma.
     * Por eso aquí enviamos todos los filtros activos en una sola llamada.
     *
     * Ejemplo: si proveedor=535 - ABBOTT y categoria=645, el backend:
     * - filtra categorias por fecha/vendedor/proveedor/ciudad, pero NO por categoria;
     * - filtra proveedores por fecha/vendedor/categoria/ciudad, pero NO por proveedor.
     *
     * Esto evita que desaparezcan proveedores/categorías válidos al cambiar fechas
     * o al seleccionar filtros múltiples.
     */
    this.filtrosService
      .getOpciones(this.filtrosService.fromDashboardFilters(fuente))
      .pipe(takeUntil(this.destroy$), catchError(() => of(null)))
      .subscribe((opciones) => {
        if (!opciones) {
          this.aplicarOpcionesProveedores([]);
          this.categoriasList = [];
          this.ciudadesList = [];
          this.aplicarOpcionesVendedores([]);
          this.cdr.markForCheck();
          return;
        }

        const filtrosReferencia = this.normalizarFiltrosDashboard(filtrosOrigen ?? this.filtrosActivos);

        this.aplicarOpcionesProveedores(
          this.conservarOpcionesSeleccionadas(
            Array.isArray(opciones.proveedores) ? opciones.proveedores : [],
            this.normalizarArrayFiltro(filtrosReferencia.proveedores, filtrosReferencia.proveedor),
            filtrosReferencia.proveedorNombres,
          ),
        );

        this.categoriasList = this.conservarOpcionesSeleccionadas(
          Array.isArray(opciones.categorias) ? opciones.categorias : [],
          this.normalizarArrayFiltro(filtrosReferencia.categorias, filtrosReferencia.categoria),
          filtrosReferencia.categoriaNombres,
        );

        const opcionesCiudades = this.conservarOpcionesSeleccionadas(
          Array.isArray(opciones.ciudades) ? opciones.ciudades : [],
          this.normalizarArrayFiltro(filtrosReferencia.ciudades, filtrosReferencia.ciudad),
          filtrosReferencia.ciudadesNombres,
        );
        this.aplicarOpcionesCiudades(opcionesCiudades);

        if (!Array.isArray(opciones.ciudades) || opciones.ciudades.length === 0) {
          // Fallback defensivo: si /api/filtros/opciones no devuelve ciudades
          // para una combinación válida, se carga el catálogo desde
          // /api/mes/cumplimiento/ciudades-global usando los mismos filtros.
          this.cargarCiudadesFallback(filtrosReferencia);
        }

        this.aplicarOpcionesVendedores(
          this.ordenarVendedoresPorCodigo(
            this.conservarOpcionesSeleccionadas(
              Array.isArray(opciones.vendedores) ? opciones.vendedores : [],
              this.normalizarArrayFiltro(filtrosReferencia.vendedores, filtrosReferencia.vendedor),
            ),
          ),
        );

        if (filtrosOrigen) {
          this.filtrosPendientes = this.normalizarFiltrosDashboard({
            ...this.filtrosPendientes,
            proveedores: this.normalizarArrayFiltro(this.filtrosPendientes.proveedores, this.filtrosPendientes.proveedor),
            categorias: this.normalizarArrayFiltro(this.filtrosPendientes.categorias, this.filtrosPendientes.categoria),
            ciudades: this.normalizarArrayFiltro(this.filtrosPendientes.ciudades, this.filtrosPendientes.ciudad),
            vendedores: this.normalizarArrayFiltro(this.filtrosPendientes.vendedores, this.filtrosPendientes.vendedor),
          });
        }

        this.cdr.markForCheck();
      });
  }

  private normalizarArrayFiltro(arr: string[] | undefined | null, legacy: unknown): string[] {
    const desdeArray = Array.isArray(arr)
      ? arr.map((item) => String(item ?? '').trim()).filter(Boolean)
      : [];

    if (desdeArray.length) return desdeArray;

    return String(legacy ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizarFiltrosDashboard(filtros: DashboardFilters): DashboardFilters {
    const vendedores = this.normalizarArrayFiltro(filtros.vendedores, filtros.vendedor);
    const proveedores = this.normalizarArrayFiltro(filtros.proveedores, filtros.proveedor);
    const categorias = this.normalizarArrayFiltro(filtros.categorias, filtros.categoria);
    const ciudades = this.normalizarArrayFiltro(filtros.ciudades, filtros.ciudad);

    return {
      ...filtros,
      vendedor: vendedores.join(','),
      vendedores,
      proveedor: proveedores.join(','),
      proveedores,
      categoria: categorias.length === 1 ? categorias[0] : '',
      categorias,
      ciudad: ciudades.length === 1 ? ciudades[0] : '',
      ciudades,
    };
  }

  private conservarOpcionesSeleccionadas(
    opciones: FilterOption[],
    valoresSeleccionados: string[],
    labelsSeleccionados?: string[],
  ): FilterOption[] {
    const mapa = new Map<string, FilterOption>();
    const normalizar = (valor: unknown): string => String(valor ?? '').trim();

    for (const opcion of Array.isArray(opciones) ? opciones : []) {
      const value = normalizar(opcion?.value);
      const label = normalizar(opcion?.label) || value;
      if (!value && !label) continue;
      mapa.set(value || label, { value: value || label, label });
    }

    (Array.isArray(valoresSeleccionados) ? valoresSeleccionados : [])
      .map((valor) => normalizar(valor))
      .filter(Boolean)
      .forEach((valor, index) => {
        if (mapa.has(valor)) return;
        const label = normalizar(labelsSeleccionados?.[index]) || valor;
        mapa.set(valor, { value: valor, label });
      });

    return Array.from(mapa.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }),
    );
  }

  private obtenerLabelsPorValores(opciones: FilterOption[], valores: string[]): string[] {
    const normalizar = (valor: unknown): string => String(valor ?? '').trim();
    return (Array.isArray(valores) ? valores : [])
      .map((valor) => {
        const valorNormalizado = normalizar(valor);
        const opcion = (Array.isArray(opciones) ? opciones : []).find(
          (item) => normalizar(item?.value) === valorNormalizado || normalizar(item?.label) === valorNormalizado,
        );
        return normalizar(opcion?.label);
      })
      .filter(Boolean);
  }

  private limpiarFiltrosInvalidosContraOpciones(
    filtros: DashboardFilters,
    opciones: {
      proveedores: FilterOption[];
      categorias: FilterOption[];
      ciudades: FilterOption[];
      vendedores: FilterOption[];
    },
  ): DashboardFilters {
    const contiene = (lista: FilterOption[], valor: string): boolean => {
      const normalizado = String(valor ?? '').trim();
      if (!normalizado) return false;
      return lista.some((opcion) => String(opcion.value ?? '').trim() === normalizado);
    };

    const filtrar = (valores: string[], lista: FilterOption[]): string[] => {
      if (!valores.length) return [];
      if (!Array.isArray(lista) || lista.length === 0) return valores;
      return valores.filter((valor) => contiene(lista, valor));
    };

    const vendedores = filtrar(
      this.normalizarArrayFiltro(filtros.vendedores, filtros.vendedor),
      opciones.vendedores,
    );
    const proveedores = filtrar(
      this.normalizarArrayFiltro(filtros.proveedores, filtros.proveedor),
      opciones.proveedores,
    );
    const categorias = filtrar(
      this.normalizarArrayFiltro(filtros.categorias, filtros.categoria),
      opciones.categorias,
    );
    const ciudades = filtrar(
      this.normalizarArrayFiltro(filtros.ciudades, filtros.ciudad),
      opciones.ciudades,
    );

    return {
      ...filtros,
      vendedor: vendedores.join(','),
      vendedores,
      proveedor: proveedores.join(','),
      proveedores,
      categoria: categorias.length === 1 ? categorias[0] : '',
      categorias,
      ciudad: ciudades.length === 1 ? ciudades[0] : '',
      ciudades,
    };
  }

  /**
   * Estado "en progreso" de los filtros: refleja lo que el usuario
   * está seleccionando en los dropdowns. Se usa SOLO para repoblar
   * los dropdowns en cascada (no se propaga a `app-ventas` para no
   * disparar recargas de tablas).
   *
   * El estado "aplicado" sigue siendo `this.filtrosActivos`, que solo
   * se actualiza en `onAplicarFiltros` cuando el usuario hace clic
   * en "Aplicar Filtros". Así las tablas y KPIs se recargan UNA vez
   * por click, no cada vez que el usuario marca/desmarca un filtro.
   */
  private filtrosPendientes: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    vendedores: [],
    proveedor: '',
    proveedores: [],
    proveedorNombre: '',
    proveedorNombres: [],
    categoria: '',
    categoriaNombre: '',
    categorias: [],
    categoriaNombres: [],
    ciudad: '',
    ciudadNombre: '',
    ciudades: [],
    ciudadesNombres: [],
    linea: '',
  };

  /**
   * Handler del `(filterChange)` del componente de filtros.
   * Re-puebla los dropdowns en cascada usando `filtrosPendientes`
   * (estado en progreso). NO toca `filtrosActivos` para que el setter
   * de `[filtros]` en app-ventas no dispare recargas innecesarias.
   */
  onFiltroChange(filtros: DashboardFilters): void {
    const anterior = { ...this.filtrosPendientes };
    this.filtrosPendientes = this.normalizarFiltrosDashboard({
      ...this.filtrosPendientes,
      ...filtros,
    });

    const cambioFechas =
      anterior.fechaInicio !== this.filtrosPendientes.fechaInicio ||
      anterior.fechaFin !== this.filtrosPendientes.fechaFin;

    if (cambioFechas) {
      this.filtrosService.invalidarCache();
      this.cumplimientoService.invalidarCacheRespuestas();
    }

    this.cargarOpcionesFiltrosUnificado(this.filtrosPendientes);
  }

  private cargarVendedoresSupervisor(): void {
    const idSupervisor = this.obtenerIdSupervisorActual();

    if (!idSupervisor) {
      this.vendedoresList = [];
      this.codigosVendedoresSupervisor = [];
      return;
    }

    this.usuariosService
      .obtenerVendedoresDelSupervisor(idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((vendedores: ApiVendedorRow[]) => {
        this.vendedorMap.clear();
        this.vendedoresList = this.construirOpcionesVendedores(vendedores);
        this.codigosVendedoresSupervisor = this.vendedoresList.map((opcion) => opcion.value);

        this.vendedoresList.forEach((opt) => {
          this.vendedorMap.set(opt.label, opt.value);
          this.vendedorMap.set(opt.value, opt.value);
        });
      });
  }

  private cargarCategoriasFiltros(): void {
    const filtrosConsulta = this.crearFiltrosCatalogo({
      conservarProveedor: true,
      conservarVendedor: true,
      conservarCategoria: false,
    });

    const proveedoresSeleccionados = this.obtenerProveedoresSeleccionados();

    // El catalogo de categorias es dependiente del proveedor:
    // - Sin proveedor: muestra todas las categorias disponibles para el rol.
    // - Con proveedor(es): primero consulta la relacion real proveedor -> categorias.
    // Importante: nunca se conserva la categoria seleccionada al recargar este catalogo,
    // porque primero cambia el proveedor y luego se deben reconstruir las opciones validas.
    if (proveedoresSeleccionados.length) {
      this.cargarCategoriasDeProveedoresSeleccionados(proveedoresSeleccionados, filtrosConsulta);
      return;
    }

    this.cargarCategoriasDesdeCuotaCategoria(filtrosConsulta, []);
  }

  private cargarCategoriasDeProveedoresSeleccionados(
    proveedoresSeleccionados: string[],
    filtrosConsulta: DashboardFilters,
  ): void {
    const requestId = ++this.categoriasRequestId;
    const proveedoresUnicos = Array.from(
      new Set(proveedoresSeleccionados.map((p) => String(p ?? '').trim()).filter(Boolean)),
    );

    const peticiones = proveedoresUnicos.map((codigoProveedor) =>
      this.proveedorService
        .getCategoriasByCodigo(codigoProveedor)
        .pipe(catchError(() => of([] as string[]))),
    );

    forkJoin(peticiones)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuestas: string[][]) => {
          if (requestId !== this.categoriasRequestId) return;

          const categorias = respuestas
            .flat()
            .map((categoria) => String(categoria ?? '').trim())
            .filter(Boolean)
            .map((categoria) => ({ categoria }));

          if (categorias.length) {
            this.categoriasList = this.construirOpcionesCategorias(categorias);
            this.cdr.markForCheck();
            return;
          }

          // Fallback: usar /cuota-categoria/general con los proveedores seleccionados.
          // Esto mantiene el comportamiento anterior cuando el backend no tiene la ruta
          // /proveedor/:codigo/categorias.
          this.cargarCategoriasDesdeCuotaCategoria(
            filtrosConsulta,
            proveedoresUnicos,
            requestId,
          );
        },
        error: () => {
          if (requestId !== this.categoriasRequestId) return;
          this.cargarCategoriasDesdeCuotaCategoria(
            filtrosConsulta,
            proveedoresUnicos,
            requestId,
          );
        },
      });
  }

  private cargarCategoriasDesdeCuotaCategoria(
    filtrosConsulta: DashboardFilters,
    proveedoresSeleccionados: string[],
    requestId = ++this.categoriasRequestId,
  ): void {
    this.cumplimientoService
      .getCuotaCategoriaGeneral(filtrosConsulta)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (requestId !== this.categoriasRequestId) return;

          const detalle = this.normalizarDetalleParaCategorias(res);
          const categorias = this.resolverCategoriasPorProveedor(detalle, proveedoresSeleccionados);

          this.categoriasList = this.construirOpcionesCategorias(categorias);
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (requestId !== this.categoriasRequestId) return;

          console.error('Error cargando categorias filtradas:', err);
          this.categoriasList = [];
          this.cdr.markForCheck();
        },
      });
  }

  private cargarCategoriasDesdeCumplimientoAdmin(
    filtrosConsulta: DashboardFilters,
    proveedores: string[],
  ): void {
    this.cumplimientoService
      .getCumplimientoMesAdmin(filtrosConsulta)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.respuestaCumplimientoOriginal = res;
          this.aplicarCategoriasDesdeRespuesta(res, proveedores);
        },
        error: (err) => {
          console.error('Error cargando categorías desde cumplimiento admin:', err);
          this.categoriasList = [];
          this.cdr.markForCheck();
        },
      });
  }

  private cargarCategoriasDesdeCumplimientoPorRol(
    filtrosConsulta: DashboardFilters,
    proveedores: string[],
  ): void {
    // Microtarea B4: 1 sola llamada al endpoint role-aware /front/me.
    // A pesar del nombre "getCumplimientoMesVendedor", este método apunta
    // a /api/mes/cumplimiento/front/me que filtra por scope JWT (admin:
    // todos, supervisor: equipo, vendor: solo él). Se eliminó la N+1 que
    // iteraba per-vendor con forkJoin.
    this.cumplimientoService
      .getCumplimientoMesVendedor(filtrosConsulta)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.respuestaCumplimientoOriginal = res;
          this.aplicarCategoriasDesdeRespuesta(res, proveedores);
        },
        error: (err) => {
          console.error('Error cargando categorías desde cumplimiento por proveedor:', err);
          this.categoriasList = [];
          this.cdr.markForCheck();
        },
      });
  }

  private cargarCategoriasSupervisorLazy(
    codigos: string[],
    filtrosConsulta: DashboardFilters,
    proveedores: string[],
  ): void {
    // No se usa actualmente: para supervisor, los catalogos se cargan en
    // VentasComponent. Este metodo se mantiene por si en el futuro se
    // quiere cargar catalogos per-vendor desde el DashboardComponent.
  }

  private aplicarCategoriasDesdeRespuesta(res: any, proveedores: string[]): void {
    const detalleNormalizado = this.normalizarDetalleParaCategorias(res);
    const categoriasUnicas = this.extraerCategoriasDeCumplimiento(
      { detalle: detalleNormalizado },
      proveedores,
    );

    // Importante: el dropdown ya pinta la opción "Todas" por separado.
    // Por eso categoriasList solo debe contener categorías reales del proveedor
    // seleccionado o categorías generales cuando no hay proveedor seleccionado.
    this.categoriasList = this.construirOpcionesCategorias(categoriasUnicas);
    this.cdr.markForCheck();
  }

  private normalizarDetalleParaCategorias(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.detalle)) return res.detalle;
    if (Array.isArray(res?.data)) return res.data;
    return [];
  }

  private obtenerProveedoresSeleccionados(): string[] {
    if (Array.isArray(this.filtrosActivos.proveedores)) {
      return this.filtrosActivos.proveedores
        .map((p) => String(p ?? '').trim())
        .filter(Boolean);
    }

    return String(this.filtrosActivos.proveedor ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private obtenerCacheClave(filtros: DashboardFilters): string {
    return [
      String(filtros.fechaInicio ?? '').trim(),
      String(filtros.fechaFin ?? '').trim(),
      String(filtros.vendedor ?? '').trim(),
      this.rolId,
    ].join('|');
  }

  private resolverCategoriasPorProveedor(
    detalle: any[],
    proveedoresSeleccionados: string[],
  ): ApiCategoriaRow[] {
    const detalleNormalizado = Array.isArray(detalle) ? detalle : [];

    if (!proveedoresSeleccionados.length) {
      const categoriasDesdeProveedores = this.extraerCategoriasDeCumplimiento(
        { detalle: detalleNormalizado },
        [],
      );

      return categoriasDesdeProveedores.length
        ? categoriasDesdeProveedores
        : this.eliminarCategoriasDuplicadas(detalleNormalizado);
    }

    const proveedoresSet = this.construirSetProveedoresFlexible(proveedoresSeleccionados);

    // Caso 1: la respuesta trae proveedores con arreglo interno de categorias.
    // Este es el caso mas confiable para construir el catalogo dependiente.
    const categoriasDesdeProveedores = this.extraerCategoriasDeCumplimiento(
      { detalle: detalleNormalizado },
      proveedoresSeleccionados,
    );

    if (categoriasDesdeProveedores.length) {
      return categoriasDesdeProveedores;
    }

    // Caso 2: la respuesta trae filas planas de categoria con campos del proveedor.
    // Aqui filtramos las filas antes de construir las opciones del dropdown.
    const categoriasDirectasFiltradas = detalleNormalizado.filter((item) =>
      this.filaCategoriaPerteneceAProveedor(item, proveedoresSet),
    );

    if (categoriasDirectasFiltradas.length) {
      return this.eliminarCategoriasDuplicadas(categoriasDirectasFiltradas);
    }

    // Caso 3: algunos endpoints ya devuelven la data filtrada por proveedor pero sin
    // campos de proveedor en cada fila. En ese escenario no hay mas informacion para
    // cruzar en frontend, por eso se respetan las filas que devolvio el backend.
    return this.eliminarCategoriasDuplicadas(detalleNormalizado);
  }

  private filaCategoriaPerteneceAProveedor(item: any, proveedoresSet: Set<string>): boolean {
    if (!item || typeof item !== 'object' || !proveedoresSet.size) return false;

    const candidatos = [
      item?.codigoProveedor,
      item?.codigo_proveedor,
      item?.codProveedor,
      item?.cod_proveedor,
      item?.idProveedor,
      item?.id_proveedor,
      item?.codigoLinea,
      item?.codigo_linea,
      item?.linea,
      item?.reporteProvConObs,
      item?.nombreProveedor,
      item?.nombre_proveedor,
      item?.nomProveedor,
      item?.proveedor,
      item?.nombre,
    ];

    return candidatos.some((candidato) =>
      this.obtenerClavesProveedor(candidato).some((clave) => proveedoresSet.has(clave)),
    );
  }

  private eliminarCategoriasDuplicadas(categorias: ApiCategoriaRow[]): ApiCategoriaRow[] {
    const mapa = new Map<string, ApiCategoriaRow>();

    (Array.isArray(categorias) ? categorias : []).forEach((cat) => {
      const idCategoria = String(
        cat?.idCategoria ?? cat?.id_categoria ?? cat?.categoria_id ?? '',
      ).trim();
      const nombreCategoria = String(
        cat?.categoria ?? cat?.nomCategoria ?? cat?.nombreCategoria ?? '',
      ).trim();

      if (!nombreCategoria && !idCategoria) return;

      const key = idCategoria || nombreCategoria;
      if (!mapa.has(key)) {
        mapa.set(key, { ...cat, idCategoria: idCategoria || cat?.idCategoria, categoria: nombreCategoria || cat?.categoria });
      }
    });

    return Array.from(mapa.values());
  }

  private cargarCategoriasGeneralesPorVendedor(
    filtrosConsulta: DashboardFilters,
    codigos: string[],
  ): void {
    const filtrosSinProveedor: DashboardFilters = {
      ...filtrosConsulta,
      proveedor: '',
      proveedores: [],
      proveedorNombre: '',
      proveedorNombres: [],
    };

    if (this.esSupervisor) {
      // Para supervisor, los catalogos se cargan en VentasComponent.
      this.categoriasList = [];
      this.cdr.markForCheck();
      return;
    }

    const peticiones = codigos.map((codigo) =>
      this.cumplimientoService
        .getCumplimientoMesVendedor(filtrosSinProveedor)
        .pipe(catchError(() => of({ detalle: [] } as any))),
    );

    forkJoin(peticiones)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (respuestas: any[]) => {
          const categoriasUnicas = this.extraerCategoriasDeCumplimiento(
            { detalle: respuestas.flatMap((r) => r?.detalle ?? []) },
            [],
          );
          this.categoriasList = this.construirOpcionesCategorias(categoriasUnicas);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando categorías generales por vendedor:', err);
          this.categoriasList = [];
          this.cdr.markForCheck();
        },
      });
  }

  private extraerCategoriasDeCumplimiento(
    res: any,
    proveedoresFiltro: string[],
  ): ApiCategoriaRow[] {
    const proveedoresSet =
      proveedoresFiltro.length > 0
        ? this.construirSetProveedoresFlexible(proveedoresFiltro)
        : null;

    const categoriasUnicas = new Map<string, ApiCategoriaRow>();
    const detalleNormalizado = this.normalizarDetalleParaCategorias(res);
    const proveedoresHoja = this.extraerProveedoresHoja(detalleNormalizado);

    proveedoresHoja.forEach((prov: any) => {
      if (proveedoresSet && !this.coincideProveedor(prov, proveedoresSet)) return;

      const categorias = Array.isArray(prov?.categorias) ? prov.categorias : [];
      categorias.forEach((cat: any) => {
        const idCategoria = String(
          cat?.idCategoria ?? cat?.id_categoria ?? cat?.categoria_id ?? '',
        ).trim();
        const nombreCategoria = String(
          cat?.categoria ?? cat?.nomCategoria ?? cat?.nombreCategoria ?? '',
        ).trim();
        if (!nombreCategoria) return;
        const key = idCategoria || nombreCategoria;
        if (!categoriasUnicas.has(key)) {
          categoriasUnicas.set(key, {
            idCategoria: idCategoria || undefined,
            categoria: nombreCategoria,
          });
        }
      });
    });

    return Array.from(categoriasUnicas.values());
  }

  private extraerProveedoresHoja(items: any[]): any[] {
    const proveedores: any[] = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item || typeof item !== 'object') return;

      if (Array.isArray(item.detallePorProveedor)) {
        item.detallePorProveedor.forEach((prov: any) => {
          if (prov && typeof prov === 'object') proveedores.push(prov);
        });
        return;
      }

      if (Array.isArray(item.proveedores)) {
        item.proveedores.forEach((prov: any) => {
          if (prov && typeof prov === 'object') proveedores.push(prov);
        });
        return;
      }

      const tieneCodigo =
        item?.codigoProveedor !== undefined ||
        item?.idProveedor !== undefined ||
        item?.codigo_proveedor !== undefined;
      const tieneCategorias = Array.isArray(item?.categorias);

      if (tieneCodigo || tieneCategorias) {
        proveedores.push(item);
      }
    });
    return proveedores;
  }

  private extraerCodigoProveedor(item: any): string {
    if (!item) return '';
    const candidatos = [
      item?.codigoProveedor,
      item?.codigo_proveedor,
      item?.codigo,
      item?.cod,
      item?.idProveedor,
      item?.id_proveedor,
    ];
    for (const candidato of candidatos) {
      const normalizado = String(candidato ?? '').trim();
      if (normalizado) return normalizado;
    }
    return '';
  }

  private construirSetProveedoresFlexible(proveedores: string[]): Set<string> {
    const set = new Set<string>();

    proveedores.forEach((prov) => {
      this.obtenerClavesProveedor(prov).forEach((clave) => set.add(clave));
    });

    return set;
  }

  private coincideProveedor(prov: any, proveedoresSet: Set<string>): boolean {
    const candidatos = [
      prov?.codigoProveedor,
      prov?.codigo_proveedor,
      prov?.codigo,
      prov?.cod,
      prov?.idProveedor,
      prov?.id_proveedor,
      prov?.nombreProveedor,
      prov?.nombre_proveedor,
      prov?.nomProveedor,
      prov?.proveedor,
      prov?.nombre,
      prov?.linea,
      prov?.reporteProvConObs,
    ];

    return candidatos.some((candidato) =>
      this.obtenerClavesProveedor(candidato).some((clave) => proveedoresSet.has(clave)),
    );
  }

  private obtenerClavesProveedor(valor: unknown): string[] {
    const texto = String(valor ?? '').trim();
    if (!texto) return [];

    const claves = new Set<string>();
    const agregar = (item: string): void => {
      const limpio = String(item ?? '').trim();
      if (!limpio) return;

      claves.add(limpio);
      claves.add(limpio.toLowerCase());

      const sinCeros = limpio.replace(/^0+/, '');
      if (sinCeros && sinCeros !== limpio) {
        claves.add(sinCeros);
        claves.add(sinCeros.toLowerCase());
      }
    };

    agregar(texto);

    // Soporta valores que lleguen como "020 - ARCOR" o "060 - LUKER PROCOVAL".
    // En esos casos el checkbox puede emitir la etiqueta completa, pero el backend
    // y la respuesta suelen traer solo codigoProveedor = "020" / "060".
    const codigoInicial = texto.match(/^\s*0*(\d+)/)?.[1];
    const codigoConCeros = texto.match(/^\s*(\d+)/)?.[1];

    if (codigoConCeros) agregar(codigoConCeros);
    if (codigoInicial) agregar(codigoInicial);

    return Array.from(claves);
  }

  onVendedorChange(vendedor: string): void {
    const filtros: DashboardFilters = {
      ...this.filtrosActivos,
      vendedor: String(vendedor ?? '').trim(),
    };

    this.onAplicarFiltros(filtros);
  }

  onProveedorChange(proveedor: string): void {
    const proveedores = String(proveedor ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const filtros: DashboardFilters = {
      ...this.filtrosActivos,
      proveedor: proveedores.join(','),
      proveedores,
      proveedorNombre: '',
      proveedorNombres: [],
      categoria: '',
      categoriaNombre: '',
      categorias: [],
      categoriaNombres: [],
    };

    this.onAplicarFiltros(filtros);
  }

  onAplicarFiltros(filtros: DashboardFilters): void {
    filtros = this.normalizarFiltrosDashboard(filtros);
    console.debug('[Dashboard] Aplicando filtros:', filtros);
    
    const rangoDefault = this.getDefaultDateRange();
    const fechaInicio = String(filtros.fechaInicio ?? '').trim() || rangoDefault.inicio;
    const fechaFin = String(filtros.fechaFin ?? '').trim() || rangoDefault.fin;

    let ciudadVisible = String(filtros.ciudad ?? '').trim();
    const ciudadNombreVisible = String(filtros.ciudadNombre ?? '').trim();
    if (this.esCiudadResumen(ciudadVisible)) {
      ciudadVisible = '';
    }

    const ciudadNormalizada = this.normalizarTexto(ciudadVisible);

    const filtrosConCodigos: DashboardFilters = {
      fechaInicio,
      fechaFin,
      vendedor: '',
      vendedores: [],
      proveedor: '',
      proveedores: [],
      proveedorNombre: '',
      proveedorNombres: [],
      categoria: filtros.categoria || '',
      categoriaNombre: filtros.categoriaNombre || '',
      categorias: filtros.categorias ?? [],
      categoriaNombres: filtros.categoriaNombres ?? [],
      ciudad: '',
      ciudades: [],
      ciudadNombre: ciudadNombreVisible || ciudadVisible || '',
      ciudadesNombres: filtros.ciudadesNombres ?? [],
      linea: filtros.linea || '',
    };

    console.debug('[Dashboard] Filtros con códigos:', filtrosConCodigos);
    console.debug('[Dashboard] Categorías seleccionadas:', filtrosConCodigos.categorias);

    // Vendedores: soporta array multi (nuevo) o string legacy
    const vendedoresSeleccionados = Array.isArray(filtros.vendedores) && filtros.vendedores.length
      ? filtros.vendedores.filter(Boolean)
      : (filtros.vendedor
          ? [String(filtros.vendedor).trim()].filter(Boolean)
          : []);

    if (vendedoresSeleccionados.length) {
      const vendedoresMapeados = vendedoresSeleccionados.map(
        (v) => this.vendedorMap.get(v) ?? v,
      );
      filtrosConCodigos.vendedor = vendedoresMapeados.join(',');
      filtrosConCodigos.vendedores = vendedoresMapeados;
    }

    const proveedoresSeleccionados = Array.isArray(filtros.proveedores) && filtros.proveedores.length
      ? filtros.proveedores.filter(Boolean)
      : String(filtros.proveedor ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    if (proveedoresSeleccionados.length) {
      const proveedoresMapeados = proveedoresSeleccionados.map(
        (proveedor) => this.proveedorMap.get(proveedor) ?? proveedor,
      );

      const proveedorNombres = Array.isArray(filtros.proveedorNombres) && filtros.proveedorNombres.length
        ? filtros.proveedorNombres
        : this.obtenerLabelsPorValores(this.proveedoresList, proveedoresSeleccionados);

      filtrosConCodigos.proveedor = proveedoresMapeados.join(',');
      filtrosConCodigos.proveedores = proveedoresMapeados;
      filtrosConCodigos.proveedorNombres = proveedorNombres;
      filtrosConCodigos.proveedorNombre = proveedorNombres.length === 1 ? proveedorNombres[0] : '';
    }

    // Ciudades: soporta array multi (nuevo) o string legacy
    const ciudadesSeleccionadas = Array.isArray(filtros.ciudades) && filtros.ciudades.length
      ? filtros.ciudades.filter(Boolean)
      : (filtros.ciudad
          ? [String(filtros.ciudad).trim()].filter(Boolean)
          : []);

    if (ciudadesSeleccionadas.length) {
      const ciudadesMapeadas = ciudadesSeleccionadas.map(
        (c) => this.ciudadMap.get(c) ?? this.ciudadMap.get(this.normalizarTexto(c)) ?? c,
      );
      const ciudadesNombres = Array.isArray(filtros.ciudadesNombres) && filtros.ciudadesNombres.length
        ? filtros.ciudadesNombres
        : this.obtenerLabelsPorValores(this.ciudadesList, ciudadesSeleccionadas);
      const ciudadesNombresCompletos = ciudadesMapeadas.map((codigo, index) => {
        const existente = String(ciudadesNombres[index] ?? '').trim();
        if (existente) return existente;
        const opcion = this.ciudadesList.find((item) => String(item.value ?? '').trim() === String(codigo).trim());
        return String(opcion?.label ?? ciudadesSeleccionadas[index] ?? codigo).trim();
      });

      filtrosConCodigos.ciudad = ciudadesMapeadas.join(',');
      filtrosConCodigos.ciudades = ciudadesMapeadas;
      filtrosConCodigos.ciudadNombre = ciudadNombreVisible || (ciudadesNombresCompletos.length === 1 ? ciudadesNombresCompletos[0] : '');
      filtrosConCodigos.ciudadesNombres = ciudadesNombresCompletos;
    } else if (ciudadVisible) {
      // Fallback: si solo llega el singular ciudad, usarlo
      filtrosConCodigos.ciudad =
        this.ciudadMap.get(ciudadVisible) ??
        this.ciudadMap.get(ciudadNormalizada) ??
        ciudadVisible;
    }

    if (filtros.linea) {
      filtrosConCodigos.linea = this.lineaMap.get(filtros.linea) ?? filtros.linea;
    }

    const filtrosAnterior = { ...this.filtrosActivos };
    this.filtrosActivos = { ...filtrosConCodigos };
    this.filtrosPendientes = { ...this.filtrosActivos };

    const cambioFechas =
      filtrosAnterior.fechaInicio !== this.filtrosActivos.fechaInicio ||
      filtrosAnterior.fechaFin !== this.filtrosActivos.fechaFin;
    const cambioProveedor =
      filtrosAnterior.proveedor !== this.filtrosActivos.proveedor ||
      JSON.stringify(filtrosAnterior.proveedores ?? []) !==
        JSON.stringify(this.filtrosActivos.proveedores ?? []);
    const cambioCategoria =
      filtrosAnterior.categoria !== this.filtrosActivos.categoria ||
      JSON.stringify(filtrosAnterior.categorias ?? []) !==
        JSON.stringify(this.filtrosActivos.categorias ?? []);
    const cambioVendedor = filtrosAnterior.vendedor !== this.filtrosActivos.vendedor;
    const cambioCiudad =
      filtrosAnterior.ciudad !== this.filtrosActivos.ciudad ||
      JSON.stringify(filtrosAnterior.ciudades ?? []) !==
        JSON.stringify(this.filtrosActivos.ciudades ?? []);

    if (cambioFechas || cambioProveedor || cambioCategoria || cambioVendedor || cambioCiudad) {
      this.cumplimientoService.invalidarCacheRespuestas();
    }

    // Re-poblar los 4 desplegables en cascada tras aplicar filtros
    // (1 sola llamada al endpoint /api/filtros/opciones).
    this.cargarOpcionesFiltrosUnificado();

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

    // Para cuota diaria usamos el mismo endpoint que el componente de
    // análisis de ventas (`/api/roles/cuota-dia/por-vendedor`).
    // Esto garantiza que las cards y la sección de análisis muestren
    // exactamente los mismos datos cuando el rol vendedor selecciona
    // "Cuota Diaria / Venta Diaria".
    if (this.tipoCuota === 'diaria') {
      this.cargarTotalesVendedorCuotaDiaria(filtros);
      return;
    }

    const obs$ =
      this.tipoCuota === 'mensual'
        ? this.cumplimientoService.getCumplimientoMesVendedor(filtros)
        : this.semanaService.getCumplimientoSemanaVendedor(filtros);

    const campo =
      this.tipoCuota === 'semanal' ? 'cuotaSemana' : 'cuotaMes';

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiTotalesResponse<DashboardTotalesVendedor> & { totales?: any }) => {
        const detalle = (res?.detalle ?? []).filter((v) => v.codVendedor !== 'TOTALES');
        const d = detalle[0] ?? null;

        const totales = res?.totales ?? null;

        if (!d) {
          if (totales) {
              this.totalesVendedor = {
                ventaAcum: Number(totales?.totalVenta ?? totales?.ventaAcum ?? 0) || 0,
                cuotaMes: Number(totales?.cuotaMes ?? totales?.cuotaDia ?? 0) || 0,
                cuotaSemana: Number(totales?.cuotaSemana ?? totales?.cuotaDia ?? 0) || 0,
                cuotaDiaria: Number(totales?.cuotaDia ?? totales?.cuotaDiaria ?? 0) || 0,
                porcCump: Number(totales?.porcCump ?? 0) || 0,
                proyeccionVenta:
                  Number(totales?.promedioDiario ?? totales?.proyeccionVenta ?? 0) || 0,
              };
              this.cdr.markForCheck();
              return;
            }

            this.totalesVendedor = null;
            this.cdr.markForCheck();
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

        this.totalesVendedor = {
          ventaAcum: Number(d.ventaAcum ?? d.ventaDiaria ?? 0) || 0,
          cuotaMes:
            cuotaMesVal ||
            (this.tipoCuota === 'mensual' ? Number(d[campo] ?? 0) : cuotaMesVal) ||
            Number(d.cuotaDia ?? 0) ||
            0,
          cuotaSemana:
            cuotaSemanaVal ||
            (this.tipoCuota === 'semanal' ? Number(d[campo] ?? 0) : cuotaSemanaVal),
          cuotaDiaria: Number(d.cuotaDiaria ?? d.cuotaDia ?? 0) || 0,
          porcCump: Number(d.porcCump ?? 0) || 0,
          proyeccionVenta: Number(d.proyeccionVenta ?? d.promedioDiario ?? 0) || 0,
        };
        this.cdr.markForCheck();
      },
      error: () => {
        this.totalesVendedor = null;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Carga las cards (totalesVendedor) usando el mismo endpoint que el
   * componente de análisis de ventas para cuota diaria.
   *
   * Antes: usaba `cumplimientoService.getCumplimientoDiaVendedor` que apuntaba
   * a `/api/dia/cumplimiento/front/me`. Ese endpoint no devolvía la data
   * esperada para el rol vendedor y las cards se quedaban en $0.
   *
   * Ahora: usa `cuotaDiaService.getCuotaDiaVendedor` que apunta a
   * `/api/roles/cuota-dia/por-vendedor`, el mismo endpoint que ya pintaba
   * correctamente la sección "Análisis de Ventas".
   */
  private cargarTotalesVendedorCuotaDiaria(filtros: DashboardFilters): void {
    const fechaInicio = String(filtros.fechaInicio ?? '').trim();
    const fechaFin = String(filtros.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      this.totalesVendedor = null;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaVendedor({ fechaInicio, fechaFin })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cuotas: CuotaDiaVendedor[]) => {
          if (!Array.isArray(cuotas) || !cuotas.length) {
            this.totalesVendedor = null;
            this.cdr.markForCheck();
            return;
          }

          const cuota = cuotas[0];
          const cuotaDiaria = Number(cuota.cuota_dia ?? 0) || 0;
          const ventaAcum = Number(cuota.venta_acumulada_dia ?? 0) || 0;
          const porcCump = Number(cuota.pct_cumplimiento ?? 0) || 0;
          const proyeccionVenta = Number(cuota.proye_venta ?? 0) || 0;

          this.totalesVendedor = {
            ventaAcum,
            // Cuando la cuota activa es diaria, los 3 "slots" de cuota
            // (mes / semana / dia) muestran el mismo valor de cuota del día
            // para que el template no muestre $0 en ningún modo.
            cuotaDiaria,
            cuotaMes: cuotaDiaria,
            cuotaSemana: cuotaDiaria,
            porcCump,
            proyeccionVenta,
          };
          this.cdr.markForCheck();
        },
        error: () => {
          this.totalesVendedor = null;
          this.cdr.markForCheck();
        },
      });
  }
}
