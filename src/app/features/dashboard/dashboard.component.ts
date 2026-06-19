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

  totalesVendedor: DashboardTotalesVendedor | null = null;
  mensajeErrorTotalesVendedor = '';

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

    const pivotDate = this.filtrosActivos.fechaInicio || this.formatDate(new Date());
    const newRange = this.adjustDateRangeForTipoCuota(tipo, pivotDate);

    this.filtrosActivos = {
      ...this.filtrosActivos,
      fechaInicio: newRange.inicio,
      fechaFin: newRange.fin,
    };

    this.refrescarDashboardSincronizado();
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
    const unicas = new Map<string, string>();

    (Array.isArray(detalle) ? detalle : []).forEach((item) => {
      const categoriaRaw = this.obtenerNombreCategoria(item);
      if (!categoriaRaw) return;

      const categoriaLimpia = this.limpiarNombreCategoria(categoriaRaw);
      if (!categoriaLimpia) return;

      if (!unicas.has(categoriaLimpia)) {
        unicas.set(categoriaLimpia, categoriaRaw);
      }
    });

    return Array.from(unicas.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true, sensitivity: 'base' }));
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
    if (this.esAdmin) {
      this.cargarVendedoresFiltrosGlobal();
      this.cargarCiudadesYLineasAdmin();
    } else if (this.esSupervisor) {
      this.cargarVendedoresSupervisor();
      this.cargarCiudadesYLineasSupervisor();
    } else if (this.codigoVendedor) {
      this.cargarOpcionesVendedor(this.filtrosActivos);
    } else {
      this.resolverCodigoVendedorDesdeApi();
    }

    this.cargarProveedoresFiltros();
    this.cargarCategoriasFiltros();
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
    });

    const aplicar = (detalle: ApiCategoriaRow[]): void => {
      this.categoriasList = this.construirOpcionesCategorias(detalle);
    };

    if (this.esAdmin && !String(this.filtrosActivos.vendedor ?? '').trim()) {
      this.cumplimientoService
        .getCuotaCategoriasPorVendedores(filtrosConsulta)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: ApiTotalesResponse<ApiCategoriaRow>) => aplicar(res?.detalle ?? []));
      return;
    }

    this.codigosParaCatalogosPorRol((codigos) => {
      if (!codigos.length) {
        this.categoriasList = [];
        return;
      }

      const peticiones = codigos.map((codigo) =>
        this.cumplimientoService
          .getCuotaCategoriaPorVendedor(codigo, filtrosConsulta)
          .pipe(catchError(() => of({ detalle: [] } as ApiTotalesResponse<ApiCategoriaRow>))),
      );

      forkJoin(peticiones)
        .pipe(takeUntil(this.destroy$))
        .subscribe((respuestas: Array<ApiTotalesResponse<ApiCategoriaRow>>) => {
          aplicar(respuestas.flatMap((res) => res?.detalle ?? []));
        });
    });
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
    const rangoDefault = this.getDefaultDateRange();
    const fechaFiltroInicio = String(filtros.fechaInicio ?? '').trim() || rangoDefault.inicio;
    const rangoPeriodo = this.adjustDateRangeForTipoCuota(this.tipoCuota, fechaFiltroInicio);
    const fechaInicio = rangoPeriodo.inicio;
    const fechaFin = rangoPeriodo.fin;

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

    this.filtrosActivos = { ...filtrosConCodigos };

    // Refresca catálogos según el rol actual. Proveedores/ciudades no se limitan por la ciudad seleccionada;
    // categorías sí respetan proveedor y vendedor para mostrar solo lo que corresponde.
    this.cargarProveedoresFiltros();
    this.cargarCategoriasFiltros();

    if (this.esAdmin) {
      this.cargarCiudadesYLineasAdmin();
    } else if (this.esSupervisor) {
      this.cargarCiudadesYLineasSupervisor();
    } else {
      this.cargarOpcionesVendedor({ ...this.filtrosActivos, ciudad: '', ciudadNombre: '' });
    }

    this.refrescarDashboardSincronizado();
  }

  private refrescarDashboardSincronizado(): void {
    if (this.rolId === 3) {
      this.cargarTotalesVendedor();
    }

    // Para VENDEDOR el ViewChild apunta al app-ventas directo.
    // ADMIN y SUPERVISOR recargan sus cards/tablas desde sus @Input actualizados.
    this.ventasRef?.reloadView(true);
  }

  private normalizarNumero(valor: unknown): number {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

    const texto = String(valor ?? '').trim();
    if (!texto) return 0;

    let normalizado = texto;

    // Soporta formatos: 18313184, 18.313.184, 18.313.184,50, 212.07 y 212,07.
    if (normalizado.includes(',') && normalizado.includes('.')) {
      normalizado = normalizado.replace(/\./g, '').replace(',', '.');
    } else if (normalizado.includes(',')) {
      normalizado = normalizado.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(normalizado)) {
      normalizado = normalizado.replace(/\./g, '');
    }

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  }

  private limpiarTotalesVendedor(mensaje = ''): void {
    this.totalesVendedor = {
      ventaAcum: 0,
      cuotaMes: 0,
      cuotaSemana: 0,
      cuotaDiaria: 0,
      porcCump: 0,
      proyeccionVenta: 0,
    };
    this.mensajeErrorTotalesVendedor = mensaje;
    this.cdr.markForCheck();
  }

  private cargarTotalesDiariosVendedor(): void {
    const fechaInicio = String(this.filtrosActivos.fechaInicio ?? '').trim();
    const fechaFin = String(this.filtrosActivos.fechaFin ?? fechaInicio).trim() || fechaInicio;

    if (!fechaInicio || !fechaFin) {
      this.limpiarTotalesVendedor('Selecciona una fecha válida para consultar la cuota diaria.');
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaVendedorResponse({ fechaInicio, fechaFin })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const fila = Array.isArray(res?.data) ? res.data[0] : null;

          if (!res?.success || !fila) {
            this.limpiarTotalesVendedor('No hay datos de cuota diaria para la fecha seleccionada.');
            return;
          }

          const cuotaDia = this.normalizarNumero(fila.cuota_dia);
          const ventaDia = this.normalizarNumero(fila.venta_acumulada_dia);

          this.totalesVendedor = {
            ventaAcum: ventaDia,
            ventaDiaria: ventaDia,
            cuotaMes: cuotaDia,
            cuotaDiaria: cuotaDia,
            cuotaDia,
            porcCump: this.normalizarNumero(fila.pct_cumplimiento),
            proyeccionVenta: this.normalizarNumero(fila.proye_venta),
            codVendedor: this.normalizarCodigoVendedor(
              fila.usuario?.vendedor?.codigo_vendedor ?? res?.vendedor?.codigo_vendedor ?? '',
            ),
          };
          this.mensajeErrorTotalesVendedor = '';
          this.cdr.markForCheck();
        },
        error: (err) => {
          const status = Number(err?.status ?? 0);
          const mensaje =
            status === 401
              ? 'Sesión expirada o token inválido. Inicia sesión nuevamente.'
              : status === 403
                ? 'Permisos insuficientes para consultar la cuota diaria del vendedor.'
                : status === 404
                  ? 'El usuario no tiene un vendedor asociado.'
                  : 'No fue posible consultar la cuota diaria del vendedor.';

          this.limpiarTotalesVendedor(mensaje);
        },
      });
  }

  private cargarTotalesVendedor(): void {
    const filtros = { ...this.filtrosActivos };

    if (this.tipoCuota === 'diaria') {
      this.cargarTotalesDiariosVendedor();
      return;
    }

    const obs$ =
      this.tipoCuota === 'mensual'
        ? this.cumplimientoService.getCumplimientoMesVendedor(filtros)
        : this.semanaService.getCumplimientoSemanaVendedor(filtros);

    const campo = this.tipoCuota === 'semanal' ? 'cuotaSemana' : 'cuotaMes';

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiTotalesResponse<DashboardTotalesVendedor> & { totales?: any }) => {
        const detalle = (res?.detalle ?? []).filter((v) => v.codVendedor !== 'TOTALES');
        const d = detalle[0] ?? null;
        const totales = res?.totales ?? null;

        if (!d && !totales) {
          this.limpiarTotalesVendedor('No hay datos para el periodo seleccionado.');
          return;
        }

        const fuente = (d ?? totales ?? {}) as Record<string, unknown>;
        const ventaAcum = this.normalizarNumero(
          fuente['ventaAcum'] ?? fuente['totalVenta'] ?? fuente['ventaDiaria'],
        );
        const cuotaMes = this.normalizarNumero(fuente['cuotaMes'] ?? fuente['cuota_mes']);
        const cuotaSemana = this.normalizarNumero(
          fuente['cuotaSemana'] ?? fuente['cuota_semana'] ?? (this.tipoCuota === 'semanal' ? fuente[campo] : 0),
        );
        const cuotaPeriodo = this.tipoCuota === 'semanal' ? cuotaSemana : cuotaMes;

        this.totalesVendedor = {
          ventaAcum,
          cuotaMes: cuotaMes || cuotaPeriodo,
          cuotaSemana,
          porcCump: this.normalizarNumero(fuente['porcCump'] ?? fuente['cumplimiento']),
          proyeccionVenta: this.normalizarNumero(
            fuente['proyeccionVenta'] ?? fuente['promedioDiario'] ?? fuente['proyeccion'],
          ),
        };
        this.mensajeErrorTotalesVendedor = '';
        this.cdr.markForCheck();
      },
      error: () => {
        this.limpiarTotalesVendedor('No fue posible cargar los totales del vendedor.');
      },
    });
  }}
