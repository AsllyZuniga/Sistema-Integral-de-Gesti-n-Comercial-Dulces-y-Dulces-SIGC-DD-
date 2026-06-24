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
import {
  FiltersComponent,
  DashboardFilters,
} from '../../shared/components/filters/filters.component';
import { FilterOption } from '../../shared/components/filters/filters.component';
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
    private usuariosService: UsuariosService,
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
    const codigo = String(
      item?.codigoLinea ??
        item?.codigo_linea ??
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
      const label = this.obtenerNombreProveedorLinea(item);
      const value = this.obtenerCodigoProveedorLinea(item);
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

    return Array.from(mapa.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }

  private construirOpcionesCategorias(detalle: ApiCategoriaRow[]): FilterOption[] {
    console.debug('[Dashboard] construyendo opciones de categorías desde:', detalle);
    
    const unicas = new Map<string, string>();

    (Array.isArray(detalle) ? detalle : []).forEach((item) => {
      const categoriaRaw = this.obtenerNombreCategoria(item);
      console.debug('[Dashboard] Categoría raw:', categoriaRaw, 'desde item:', item);
      
      if (!categoriaRaw) {
        console.debug('[Dashboard] Categoría vacía, omitiendo');
        return;
      }

      const categoriaLimpia = this.limpiarNombreCategoria(categoriaRaw);
      console.debug('[Dashboard] Categoría limpia:', categoriaLimpia);
      
      if (!categoriaLimpia) {
        console.debug('[Dashboard] Categoría limpia vacía, omitiendo');
        return;
      }

      if (!unicas.has(categoriaLimpia)) {
        unicas.set(categoriaLimpia, categoriaRaw);
      }
    });

    const opciones = Array.from(unicas.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true, sensitivity: 'base' }));
    
    console.debug('[Dashboard] Opciones de categorías finales:', opciones);
    
    return opciones;
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

    if (this.esSupervisor) {
      this.cargarProveedoresSupervisor(filtrosCatalogo);
      return;
    }

    if (this.esAdmin && !String(this.filtrosActivos.vendedor ?? '').trim()) {
      this.cumplimientoService
        .getLineasAdmin(filtrosCatalogo)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: ApiLineasResponse) => {
          this.aplicarOpcionesProveedores(
            this.construirOpcionesProveedoresDesdeLineas(res?.detallePorLinea ?? []),
          );
        });
      return;
    }

    this.codigosParaCatalogosPorRol((codigos) => {
      if (!codigos.length) {
        this.aplicarOpcionesProveedores([]);
        return;
      }

      const peticiones = codigos.map((codigo) =>
        this.cumplimientoService
          .getLineasPorVendedor(codigo, filtrosCatalogo)
          .pipe(catchError(() => of({ detallePorLinea: [] } as ApiLineasResponse))),
      );

      forkJoin(peticiones)
        .pipe(takeUntil(this.destroy$))
        .subscribe((respuestas: ApiLineasResponse[]) => {
          const lineas = respuestas.flatMap((res) => res?.detallePorLinea ?? []);
          this.aplicarOpcionesProveedores(this.construirOpcionesProveedoresDesdeLineas(lineas));
        });
    });
  }


  /**
   * Carga inicial de catalogos del supervisor (ciudades/lineas) - solo 1 vez.
   * Si la cache ya esta cargada para las fechas actuales, no hace nada.
   */
  private catalogosSupervisorCargadosKey = '';
  private categoriasSupervisorCache: ApiCategoriaRow[] = [];
  private categoriasSupervisorCacheKey = '';
  private respuestaCumplimientoCategoriasSupervisor: any = null;
  private cargarCatalogosSupervisorLazy(): void {
    const key = `${this.filtrosActivos?.fechaInicio ?? ''}|${this.filtrosActivos?.fechaFin ?? ''}`;
    if (this.catalogosSupervisorCargadosKey === key) return;
    this.catalogosSupervisorCargadosKey = key;

    this.cargarCiudadesYLineasSupervisor();
  }

  private cargarCiudadesYLineasSupervisor(): void {
    const filtrosCatalogo = this.crearFiltrosCatalogo({ conservarProveedor: true, conservarVendedor: true });

    this.codigosParaCatalogosPorRol((codigos) => {
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
            .getCiudadesPorVendedor(codigo, filtrosCatalogo)
            .pipe(catchError(() => of({ detallePorCiudad: [] } as ApiCiudadesResponse))),
          lineas: this.cumplimientoService
            .getLineasPorVendedor(codigo, filtrosCatalogo)
            .pipe(catchError(() => of({ detallePorLinea: [] } as ApiLineasResponse))),
        }),
      );

      forkJoin(peticiones)
        .pipe(takeUntil(this.destroy$))
        .subscribe((resultados: Array<{ ciudades: ApiCiudadesResponse; lineas: ApiLineasResponse }>) => {
          const ciudadesUnicas = new Set<string>();
          const lineasUnicas = new Set<string>();

          resultados.forEach((resultado) => {
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
          });

          this.ciudadesList = this.toFilterOptions(Array.from(ciudadesUnicas));
          this.lineasList = this.toFilterOptions(Array.from(lineasUnicas));
        });
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

        this.ciudadesList = this.toFilterOptions(Array.from(unicos));
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

          this.ciudadesList = this.toFilterOptions(Array.from(ciudadesSet));
          this.lineasList = this.toFilterOptions(Array.from(lineasSet));
        });
      return;
    }

    // Sin vendedor seleccionado: iterar por todos los vendors del catálogo
    // para evitar que el endpoint "global" (que en algunos meses solo devuelve
    // "SIN CIUDAD") oculte el resto de ciudades en el filtro.
    this.cargarCiudadesYLineasAdminIterandoCatalogo(filtrosBase);
  }

  private cargarCiudadesYLineasAdminIterandoCatalogo(filtrosBase: DashboardFilters): void {
    this.usuariosService
      .listarDetalleVendedores()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of([] as any[])),
      )
      .subscribe((detalleVendedores: any[]) => {
        const codigos = (Array.isArray(detalleVendedores) ? detalleVendedores : [])
          .map((v) => this.obtenerCodigoVendedorDetalle(v))
          .filter(Boolean);

        // Si no hay catálogo, fallback al endpoint global para no dejar el
        // filtro vacío en escenarios de carga inicial.
        if (!codigos.length) {
          this.cumplimientoService
            .getCiudadesGlobal(filtrosBase)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: ApiCiudadesResponse) => {
              const ciudadesDetalle = Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
              const ciudades = new Set<string>();
              ciudadesDetalle.forEach((item) => {
                this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), ciudades);
              });
              this.ciudadesList = this.toFilterOptions(Array.from(ciudades));
            });
          return;
        }

        const peticionesCiudades = codigos.map((codigo) =>
          this.cumplimientoService
            .getCiudadesPorVendedor(codigo, filtrosBase)
            .pipe(catchError(() => of({ detallePorCiudad: [] } as ApiCiudadesResponse))),
        );

        forkJoin(peticionesCiudades)
          .pipe(takeUntil(this.destroy$))
          .subscribe((respuestas: ApiCiudadesResponse[]) => {
            const ciudadesUnicas = new Set<string>();

            respuestas.forEach((res) => {
              const detalle = Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
              detalle.forEach((item: ApiCiudadRow) => {
                this.registrarCiudad(item?.ciudad, this.obtenerCiudadCodigo(item), ciudadesUnicas);
              });
            });

            this.ciudadesList = this.toFilterOptions(Array.from(ciudadesUnicas));
          });
      });

    // Las líneas (proveedores) sí se pueden cargar del endpoint admin: ya
    // está implementado abajo con getLineasAdmin.
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

  private obtenerCodigoVendedorDetalle(v: any): string {
    return String(
      v?.codVendedor ??
        v?.codigo_vendedor ??
        v?.codigoVendedor ??
        v?.cod_vendedor ??
        v?.codigo ??
        v?.cod ??
        '',
    ).trim();
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
    if (this.esAdmin) {
      this.cargarVendedoresFiltrosGlobal();
      this.cargarCiudadesYLineasAdmin();
      this.cargarProveedoresFiltros();
      this.cargarCategoriasFiltros();
    } else if (this.esSupervisor) {
      this.cargarVendedoresSupervisor();
      this.cargarCiudadesYLineasSupervisor();
    } else if (this.codigoVendedor) {
      this.cargarOpcionesVendedor(this.filtrosActivos);
      this.cargarProveedoresFiltros();
      this.cargarCategoriasFiltros();
    } else {
      this.resolverCodigoVendedorDesdeApi();
      this.cargarProveedoresFiltros();
      this.cargarCategoriasFiltros();
    }
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

        // Una vez tenemos los vendedores del supervisor, cargamos el catalogo
        // de proveedores a partir de las lineas de cada uno.
        this.cargarProveedoresFiltros();
      });
  }

  private cargarProveedoresSupervisor(filtrosCatalogo?: DashboardFilters): void {
    const filtros = filtrosCatalogo ?? this.crearFiltrosCatalogo({ conservarVendedor: true });

    this.obtenerCodigosSupervisor((codigos) => {
      if (!codigos.length) {
        this.aplicarOpcionesProveedores([]);
        return;
      }

      const peticiones = codigos.map((codigo) =>
        this.cumplimientoService
          .getLineasPorVendedor(codigo, filtros)
          .pipe(catchError(() => of({ detallePorLinea: [] } as ApiLineasResponse))),
      );

      forkJoin(peticiones)
        .pipe(takeUntil(this.destroy$))
        .subscribe((respuestas: ApiLineasResponse[]) => {
          const lineas = respuestas.flatMap((res) => res?.detallePorLinea ?? []);
          this.aplicarOpcionesProveedores(
            this.construirOpcionesProveedoresDesdeLineas(lineas),
          );
          // Cargar catalogo inicial de categorias (sin proveedor seleccionado = todas)
          this.cargarCategoriasSupervisor();
        });
    });
  }

  private cargarCategoriasSupervisor(): void {
    // MISMA logica que el administrador para el DROPDOWN de categorias:
    // 1) Llama a getCumplimientoMesAdmin (mismo endpoint que el admin usa
    //    en cargarCategoriasDesdeCumplimientoAdmin).
    // 2) El response trae `detalle` con proveedores que tienen `categorias`
    //    anidadas (misma estructura que el admin).
    // 3) Usa el MISMO helper extraerCategoriasDeCumplimiento que el admin
    //    para filtrar por proveedor y extraer categorias.
    // 4) Cache en memoria con cacheKey = fechas+vendedor (sin proveedor,
    //    igual que el admin). Al cambiar proveedor NO recarga: re-filtra
    //    en cliente con el proveedorSet.
    const filtrosCatalogo = this.crearFiltrosCatalogo({
      conservarProveedor: false, // Cargamos SIN filtro de proveedor (como el admin)
      conservarVendedor: true,
    });

    const cacheKey = `${filtrosCatalogo.fechaInicio}|${filtrosCatalogo.fechaFin}|${filtrosCatalogo.vendedor}`;

    if (
      this.respuestaCumplimientoCategoriasSupervisor &&
      this.categoriasSupervisorCacheKey === cacheKey
    ) {
      const proveedoresSeleccionados = this.obtenerProveedoresSeleccionados();
      const categoriasFiltradas = this.extraerCategoriasDeCumplimiento(
        this.respuestaCumplimientoCategoriasSupervisor,
        proveedoresSeleccionados,
      );
      this.categoriasList = this.construirOpcionesCategorias(categoriasFiltradas);
      this.cdr.markForCheck();
      return;
    }

    // Mismo endpoint que el admin para el dropdown: /cumplimiento/mes/admin
    this.cumplimientoService
      .getCumplimientoMesAdmin(filtrosCatalogo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.respuestaCumplimientoCategoriasSupervisor = res;
          this.categoriasSupervisorCacheKey = cacheKey;

          const proveedoresSeleccionados = this.obtenerProveedoresSeleccionados();
          const categoriasFiltradas = this.extraerCategoriasDeCumplimiento(
            res,
            proveedoresSeleccionados,
          );

          this.categoriasSupervisorCache = categoriasFiltradas;
          this.categoriasList = this.construirOpcionesCategorias(categoriasFiltradas);
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error cargando categorías del supervisor:', err);
          this.categoriasList = [];
          this.categoriasSupervisorCache = [];
          this.respuestaCumplimientoCategoriasSupervisor = null;
          this.categoriasSupervisorCacheKey = cacheKey;
          this.cdr.markForCheck();
        },
      });
  }

  private cargarCategoriasFiltros(): void {
    const filtrosConsulta = this.crearFiltrosCatalogo({
      conservarProveedor: true,
      conservarVendedor: true,
    });

    const proveedoresSeleccionados = this.obtenerProveedoresSeleccionados();
    const cacheClave = this.obtenerCacheClave(filtrosConsulta);

    if (
      this.respuestaCumplimientoOriginal &&
      this.cacheCumplimientoClave === cacheClave
    ) {
      this.aplicarCategoriasDesdeRespuesta(
        this.respuestaCumplimientoOriginal,
        proveedoresSeleccionados,
      );
      return;
    }

    this.cacheCumplimientoClave = cacheClave;

    const filtrosIniciales: DashboardFilters = {
      ...filtrosConsulta,
      proveedor: '',
      proveedores: [],
      proveedorNombre: '',
      proveedorNombres: [],
    };

    if (this.esAdmin && !String(this.filtrosActivos.vendedor ?? '').trim()) {
      this.cargarCategoriasDesdeCumplimientoAdmin(filtrosIniciales, proveedoresSeleccionados);
      return;
    }

    this.cargarCategoriasDesdeCumplimientoPorRol(filtrosIniciales, proveedoresSeleccionados);
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
    this.codigosParaCatalogosPorRol((codigos) => {
      if (!codigos.length) {
        this.categoriasList = [];
        this.cdr.markForCheck();
        return;
      }

      // OPTIMIZACION supervisor: el catalogo de categorias debe usar
      // SIEMPRE el endpoint per-vendor del Postman:
      //   GET /api/cuota-categoria/vendedor/:codigo
      // Pero SOLO se carga:
      //   - la primera vez que se abre la seccion
      //   - cuando cambian las fechas
      //   - cuando se selecciona un proveedor / categoria / vendedor
      // Antes se ejecutaba en cada ngOnInit y en cada cambio de filtro.
      if (this.esSupervisor) {
        // Para supervisor, los catalogos se cargan en VentasComponent.
        // Aqui solo dejamos la lista vacia para no disparar N+1 calls.
        this.categoriasList = [];
        this.cdr.markForCheck();
        return;
      }

      const peticiones = codigos.map((codigo) =>
        this.cumplimientoService
          .getCumplimientoMesVendedor(filtrosConsulta)
          .pipe(catchError(() => of({ detalle: [] } as any))),
      );

      forkJoin(peticiones)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (respuestas: any[]) => {
            const respuestaCompleta = {
              detalle: respuestas.flatMap((r) => r?.detalle ?? []),
            };
            this.respuestaCumplimientoOriginal = respuestaCompleta;
            this.aplicarCategoriasDesdeRespuesta(respuestaCompleta, proveedores);
          },
          error: (err) => {
            console.error('Error cargando categorías desde cumplimiento por proveedor:', err);
            this.categoriasList = [];
            this.cdr.markForCheck();
          },
        });
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
    console.debug('[Dashboard] Aplicando filtros:', filtros);

    const filtrosPrevios: DashboardFilters = { ...this.filtrosActivos };
    
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

    console.debug('[Dashboard] Filtros con códigos:', filtrosConCodigos);
    console.debug('[Dashboard] Categorías seleccionadas:', filtrosConCodigos.categorias);

    if (filtros.vendedor) {
      filtrosConCodigos.vendedor = this.vendedorMap.get(filtros.vendedor) ?? filtros.vendedor;
    }

    const proveedoresSeleccionados = Array.isArray(filtros.proveedores)
      ? filtros.proveedores.filter(Boolean)
      : String(filtros.proveedor ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    if (proveedoresSeleccionados.length) {
      const proveedoresMapeados = proveedoresSeleccionados.map(
        (proveedor) => this.proveedorMap.get(proveedor) ?? proveedor,
      );

      filtrosConCodigos.proveedor = proveedoresMapeados.join(',');
      filtrosConCodigos.proveedores = proveedoresMapeados;
      filtrosConCodigos.proveedorNombres = filtros.proveedorNombres ?? [];
    }

    if (ciudadVisible) {
      filtrosConCodigos.ciudad =
        this.ciudadMap.get(ciudadVisible) ?? this.ciudadMap.get(ciudadNormalizada) ?? ciudadVisible;
    }

    if (filtros.linea) {
      filtrosConCodigos.linea = this.lineaMap.get(filtros.linea) ?? filtros.linea;
    }

    // Detectar cambios contra los filtros realmente activos ANTES de reemplazarlos.
    // Antes se comparaba el objeto recién recibido contra filtrosConCodigos; en supervisor,
    // cuando el proveedor ya venía con el mismo código, cambioProveedor quedaba en false
    // y no se reconstruía el catálogo de categorías ni se refrescaban las secciones.
    const cambioProveedor =
      String(filtrosPrevios?.proveedor ?? '') !== String(filtrosConCodigos.proveedor ?? '') ||
      JSON.stringify(filtrosPrevios?.proveedores ?? []) !==
        JSON.stringify(filtrosConCodigos.proveedores ?? []);
    const cambioCategoria =
      String(filtrosPrevios?.categoria ?? '') !== String(filtrosConCodigos.categoria ?? '') ||
      JSON.stringify(filtrosPrevios?.categorias ?? []) !==
        JSON.stringify(filtrosConCodigos.categorias ?? []);
    const cambioVendedor =
      String(filtrosPrevios?.vendedor ?? '') !== String(filtrosConCodigos.vendedor ?? '');
    const cambioFechas =
      String(filtrosPrevios?.fechaInicio ?? '') !== String(filtrosConCodigos.fechaInicio ?? '') ||
      String(filtrosPrevios?.fechaFin ?? '') !== String(filtrosConCodigos.fechaFin ?? '');

    this.filtrosActivos = { ...filtrosConCodigos };

    if (this.esAdmin) {
      this.cargarProveedoresFiltros();
      this.cargarCategoriasFiltros();
      this.cargarCiudadesYLineasAdmin();
    } else if (this.esSupervisor) {
      // Supervisor: el catálogo y las tablas deben reaccionar igual que admin.
      // Proveedor/Vendedor/Fechas cambian la disponibilidad de ciudades, líneas y categorías.
      if (cambioProveedor || cambioVendedor || cambioFechas) {
        this.cumplimientoService.invalidarCachePorPrefijo('lineas-');
        this.cargarCiudadesYLineasSupervisor();
      }

      // Al cambiar proveedor se recalculan las categorías disponibles para ese proveedor.
      // Al cambiar fechas/vendedor se invalida el cache base y se vuelve a cargar.
      if (cambioProveedor || cambioVendedor || cambioFechas) {
        if (cambioFechas || cambioVendedor) {
          this.respuestaCumplimientoCategoriasSupervisor = null;
          this.categoriasSupervisorCacheKey = '';
          this.categoriasSupervisorCache = [];
        }
        this.cargarCategoriasSupervisor();
      }
    } else {
      this.cargarOpcionesVendedor({ ...this.filtrosActivos, ciudad: '', ciudadNombre: '' });
      this.cargarProveedoresFiltros();
      this.cargarCategoriasFiltros();
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

    // ⚠️ SOLO se cambia la rama DIARIA para usar el endpoint específico
    //    /api/roles/cuota-dia/por-vendedor (rol vendedor). Las ramas
    //    semanal y mensual se mantienen intactas.
    if (this.tipoCuota === 'diaria') {
      this.cargarTotalesVendedorCuotaDiaria(filtros);
      return;
    }

    const obs$ =
      this.tipoCuota === 'mensual'
        ? this.cumplimientoService.getCumplimientoMesVendedor(filtros)
        : this.semanaService.getCumplimientoSemanaVendedor(filtros);

    const campo =
      this.tipoCuota === 'semanal'
        ? 'cuotaSemana'
        : 'cuotaMes';

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
          cuotaDiaria: Number(d.cuotaDia ?? 0) || 0,
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
   * Carga los totales del vendedor para CUOTA DIARIA usando el endpoint
   * específico del rol vendedor:
   *   GET /api/roles/cuota-dia/por-vendedor?fecha_inicio=X&fecha_fin=Y
   *
   * Respuesta:
   *   {
   *     success, message, vendedor: { id_vendedor, codigo_vendedor, nombre },
   *     data: [{
   *       id_cuotaDia, cuota_dia, fecha_inicio, fecha_fin, id_usuario, usuario,
   *       venta_acumulada_dia, pct_cumplimiento, proye_venta,
   *       dias_corridos, dias_habiles
   *     }]
   *   }
   *
   * Errores manejados por el servicio:
   *   - 401 (Sin token), 403 (Rol ≠ 3), 404 (No existe vendedor asociado)
   *
   * Esta rama es INDEPENDIENTE de la lógica mensual / semanal, por lo que
   * NO afecta otros flujos.
   */
  private cargarTotalesVendedorCuotaDiaria(filtros: DashboardFilters): void {
    const fechaInicio = String(filtros.fechaInicio ?? '').trim();
    const fechaFin = String(filtros.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      console.warn('[Dashboard][CuotaDiaria] Fechas vacías, no se cargan totales');
      this.totalesVendedor = null;
      this.cdr.markForCheck();
      return;
    }

    console.debug('[Dashboard][CuotaDiaria] Solicitando /api/roles/cuota-dia/por-vendedor', {
      fechaInicio,
      fechaFin,
    });

    this.cuotaDiaService
      .getCuotaDiaVendedor({ fechaInicio, fechaFin })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (cuotas: CuotaDiaVendedor[]) => {
          const registro = Array.isArray(cuotas) && cuotas.length ? cuotas[0] : null;

          if (!registro) {
            console.warn('[Dashboard][CuotaDiaria] Sin datos para el rango solicitado');
            this.totalesVendedor = null;
            this.cdr.markForCheck();
            return;
          }

          const cuotaDiaria = this.parseNumeroFlexible(registro.cuota_dia);
          const ventaAcum = Number(registro.venta_acumulada_dia ?? 0) || 0;
          const porcCump = Number(registro.pct_cumplimiento ?? 0) || 0;
          const proyeccionVenta = Number(registro.proye_venta ?? 0) || 0;

          this.totalesVendedor = {
            ventaAcum,
            cuotaMes: 0,
            cuotaSemana: 0,
            cuotaDiaria,
            cuotaDia: cuotaDiaria,
            porcCump,
            proyeccionVenta,
            promedioDiario: proyeccionVenta,
            codVendedor:
              registro?.usuario?.vendedor?.codigo_vendedor ??
              registro?.usuario?.username ??
              '',
          };

          console.debug('[Dashboard][CuotaDiaria] Totales cargados:', this.totalesVendedor);
          this.cdr.markForCheck();
        },
        error: () => {
          this.totalesVendedor = null;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Convierte un valor (string o number) a número, manejando valores
   * que pueden llegar como string desde el backend (ej: "18313184").
   */
  private parseNumeroFlexible(valor: unknown): number {
    if (valor === null || valor === undefined) return 0;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }
}
