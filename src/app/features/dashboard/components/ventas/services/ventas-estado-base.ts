import {
  Directive,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { Observable, forkJoin, merge, of, Subject, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CumplimientoService } from '../../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { CuotaDiaService, CuotaDiaVendedor } from '../../../../../core/services/ventas/cuotaDia.service';
import { DashboardFilters } from '../../../../../shared/components/filters/filters.component';
import { AuthService } from '../../../../../core/services/auth.service';
import { TipoCuota } from '../../../../cumplimientos-cuota/cumplimientos.component';
import { environment } from '../../../../../../environments/environment';
import { RoleId } from '../../../../../core/auth/roles';
import {
  VENTAS_VIEW_STORAGE_KEY,
  VENTAS_VIEWS,
  esVistaVentasPermitidaPorRol,
  obtenerVistasVentasPorRol,
} from '../config/ventas-view.config';


@Directive()
export abstract class VentasEstadoBase implements OnInit, OnDestroy {
  protected cumplimientoService = inject(CumplimientoService);
  protected semanaService = inject(CumplimientoSemanaService);
  protected cuotaDiaService = inject(CuotaDiaService);
  protected authService = inject(AuthService);
  protected cdr = inject(ChangeDetectorRef);

  protected readonly activeViewStorageKey = VENTAS_VIEW_STORAGE_KEY;
  @Output() resumenCambio = new EventEmitter<{
    ventaAcum: number;
    cuota?: number;
    porcCump?: number;
    proyeccionVenta?: number;
  }>();

  @Input() set codigoVendedor(value: string) {
    this._codigoVendedor = this.normalizarCodigoVendedor(value);
    console.debug(
      '[Ventas][setter] codigoVendedor set =>',
      value,
      'normalized=>',
      this._codigoVendedor,
      'iniciado=>',
      this.iniciado,
      'esModoAdminTodos=>',
      this.esModoAdminTodos(),
    );
    if ((value || this.esModoAdminTodos()) && this.iniciado) {
      this.solicitarCargaVista();
    }
  }
  get codigoVendedor(): string {
    return this._codigoVendedor;
  }
  protected _codigoVendedor = '';

  @Input() set modoAdmin(value: boolean) {
    this._modoAdmin = value;
    console.debug('[Ventas][setter] modoAdmin set =>', value, 'iniciado=>', this.iniciado);
    if (this.iniciado) {
      this.solicitarCargaVista(true);
    }
  }
  get modoAdmin(): boolean {
    return this._modoAdmin;
  }
  protected _modoAdmin = false;

  @Input() set vendedoresDetalle(value: any[] | null | undefined) {
    this._vendedoresDetalle = Array.isArray(value) ? value : [];

    if (this.iniciado && this.esModoAdminTodos() && this.activeVentasView === 'cliente') {
      this.solicitarCargaVista(true);
    }
  }
  get vendedoresDetalle(): any[] {
    return this._vendedoresDetalle;
  }
  protected _vendedoresDetalle: any[] = [];

  @Input() set codigosVendedores(value: string[] | null | undefined) {
    const normalizados = Array.from(
      new Set(
        (Array.isArray(value) ? value : [])
          .map((codigo) => this.normalizarCodigoVendedor(codigo))
          .filter(Boolean),
      ),
    );

    const cambio =
      normalizados.length !== this._codigosVendedoresPermitidos.length ||
      normalizados.some((codigo, index) => codigo !== this._codigosVendedoresPermitidos[index]);

    this._codigosVendedoresPermitidos = normalizados;

    console.debug(
      '[Ventas][setter] codigosVendedores set =>',
      normalizados,
      'iniciado=>',
      this.iniciado,
    );

    if (cambio && this.iniciado) {
      this.solicitarCargaVista(true);
    }
  }
  get codigosVendedores(): string[] {
    return this._codigosVendedoresPermitidos;
  }
  protected _codigosVendedoresPermitidos: string[] = [];

  @Input() set tipoCuota(value: TipoCuota) {
    const cambio = this._tipoCuota !== value;
    this._tipoCuota = value;

    if (cambio && (this._codigoVendedor || this.esModoAdminTodos()) && this.iniciado) {
      this.solicitarCargaVista(true);
    }
  }
  get tipoCuota(): TipoCuota {
    return this._tipoCuota;
  }
  protected _tipoCuota: TipoCuota = 'mensual';

  @Input() set filtros(value: DashboardFilters) {
    this._filtros = value;
    console.debug(
      '[Ventas][setter] filtros set =>',
      value,
      'codigoVendedor=>',
      this._codigoVendedor,
      'esModoAdminTodos=>',
      this.esModoAdminTodos(),
      'iniciado=>',
      this.iniciado,
    );
    if ((this._codigoVendedor || this.esModoAdminTodos()) && this.iniciado) {
      this.solicitarCargaVista(true);
    }
  }
  get filtros(): DashboardFilters {
    return this._filtros;
  }
  protected _filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    ciudadNombre: '',
    linea: '',
  };

  protected destroy$ = new Subject<void>();
  protected recargarVista$ = new Subject<void>();
  protected iniciado = false;
  protected cargaProgramada = false;
  protected cargaForzadaPendiente = false;
  protected ultimaCargaKey = '';

  rolId = 0;
  activeVentasView = 'ventas';
  chartId = 'chart-main';
  chartType: 'line' | 'bar' | 'pie' = 'line';
  tableData: any[] = [];
  chartData: any[] = [];
  protected allItemData: any[] = [];
  clientesAgrupados: any[] = [];
  clientesVista: any[] = [];
  totalClientesFiltrados = 0;
  clienteBusqueda = '';
  cargandoClientes = false;
  errorClientesMsg = '';
  totalCuotaCategoria = 0;
  totalAcumuladoCategoria = 0;
  totalTopCategorias = 0;
  totalTopProveedores = 0;
  totalTopVendedores = 0;
  totalCuotaProveedor = 0;
  totalAcumuladoProveedor = 0;
  totalTopClientes = 0;
  totalTopItemsSubtotal = 0;
  totalTopCiudades = 0;
  totalAcumuladoCiudad = 0;
  // Totales adicionales solicitados
  totalCuotaVendedor = 0;
  totalAcumuladoVendedor = 0;
  // FIX: total unificado para la vista 'ventas' (especialmente cuota diaria).
  // La card KPI consume este valor vía emitirResumenVista() para que coincida
  // con el chart y con la suma del card del dashboard padre.
  totalAcumuladoVentas = 0;
  totalCuotaCiudad = 0;
  liderVentasProveedor = '—';
  protected categoriasPorId = new Map<string, string>();
  protected cuotasDiariasCache: CuotaDiaVendedor[] = [];
  totalCuotaDiaria = 0;

  // Paginación dinámica según rol
  protected get clientesPageSize(): number {
    const esAdmin = this.rolId === RoleId.ADMINISTRADOR;
    return esAdmin ? Number.MAX_SAFE_INTEGER : 30;
  }

  readonly productosPageSize = 25;
  protected clientesVisibles = 30;
  readonly productosVisiblesPorCliente: Record<string, number> = {};

  // Paginación real (server-side) para /vendedor/con-items-comprados
  // - vendedorItemsPageSize: paginación para vendedores (sí se pagina)
  // - clienteItemsPageSize: clientes sin paginación (se muestran todos)
  // - productosItemsPageSize: items sin paginación (se muestran todos)
  readonly vendedorItemsPageSize = 10;
  readonly clienteItemsPageSize = 1000;
  readonly productosItemsPageSize = 1000;
  protected vendedoresPageActual = 1;
  protected paginacionVendedores: { page: number; limit: number; total: number } | null = null;
  protected paginacionClientesPorVendedor = new Map<
    string,
    { page: number; limit: number; total: number }
  >();
  protected paginacionItemsPorCliente = new Map<
    string,
    { page: number; limit: number; total: number }
  >();
  protected cargandoMasVendedores = false;
  protected cargandoMasClientesPorVendedor = new Set<string>();
  protected cargandoMasItemsPorCliente = new Set<string>();

  protected readonly todasLasVistas = VENTAS_VIEWS;

  get ventasViews() {
    return obtenerVistasVentasPorRol(this.rolId);
  }

  protected esVistaPermitidaPorRol(vista: string): boolean {
    return esVistaVentasPermitidaPorRol(this.rolId, vista);
  }

  get cuotaColumn(): string {
    return this._tipoCuota === 'semanal'
      ? 'cuotaSemana'
      : this._tipoCuota === 'diaria'
        ? 'cuotaDiaria'
        : 'cuotaMes';
  }

  get tableColumns(): string[] {
    return [
      'codVendedor',
      'nombre',
      this.cuotaColumn,
      'ventaAcum',
      'porcCump',
      'proyeccionVenta',
      'porcCumProy',
    ];
  }

  readonly ciudadesColumns = ['ciudad', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly categoriasColumns = [
    'categoria',
    'cuota',
    'acumulado',
    'porcentajeCumplimiento',
    'part',
    'proyectado',
    'porcentajeCumplimientoProyectado',
  ];
  readonly productosColumns = [
    'Proveedor',
    'Cod_Item',
    'Descripcion',
    'Venta_Unid_Cajas',
    'Cantidad',
    'Subtotal',
  ];
  readonly clienteProductosColumns = ['producto', 'cantidad', 'subtotal'];

  readonly lineasColumns = [
    'linea',
    'cuotaLinea',
    'ventaAcum',
    'porcCump',
    'proyeccionVenta',
    'porcCumProy',
  ];

  constructor() {
    const usuario = this.authService.getVendedor();
    this.rolId = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);
    console.debug('[VentasEstadoBase] Usuario cargado:', {
      rolId: this.rolId,
      usuarioRaw: usuario,
      rol: usuario?.rol,
      idRol: usuario?.idRol,
    });
    this.activeVentasView = this.cargarVistaActivaGuardada();
  }

  ngOnInit(): void {
    this.iniciado = true;
    // OPTIMIZACION: cargarMapaCategorias() ya no se llama aqui.
    // Se hace lazy en setVentasView() cuando el usuario abre la pestaña "categoria".
    // Esto evita 1 llamada HTTP por cada instancia de VentasComponent que se monte.
    if (this.activeVentasView === 'categoria') {
      this.cargarMapaCategorias();
    }
    // Hacer carga inicial si hay codigoVendedor O si estamos en modo admin visualizando "todos"
    if (this._codigoVendedor || this.esModoAdminTodos()) {
      this.solicitarCargaVista(true);
    }
  }

  ngOnDestroy(): void {
    this.recargarVista$.next();
    this.recargarVista$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get esSemanal(): boolean {
    return this._tipoCuota === 'semanal';
  }

  protected resetearVista(): void {
    this.tableData = [];
    this.chartData = [];
    this.allItemData = [];
    this.clientesAgrupados = [];
    this.clientesVista = [];
    this.totalClientesFiltrados = 0;
    this.clienteBusqueda = '';
    this.cargandoClientes = false;
    this.totalCuotaCategoria = 0;
    this.totalAcumuladoCategoria = 0;
    this.totalTopCategorias = 0;
    this.totalTopProveedores = 0;
    this.totalTopVendedores = 0;
    this.totalCuotaProveedor = 0;
    this.totalAcumuladoProveedor = 0;
    this.totalTopClientes = 0;
    this.totalTopItemsSubtotal = 0;
    this.totalTopCiudades = 0;
    this.totalAcumuladoCiudad = 0;
    this.totalCuotaVendedor = 0;
    this.totalAcumuladoVendedor = 0;
    this.totalAcumuladoVentas = 0;
    this.totalCuotaCiudad = 0;
    this.totalCuotaDiaria = 0;
    this.cuotasDiariasCache = [];
    this.liderVentasProveedor = '—';
    this.clientesVisibles = this.clientesPageSize;
    this.vendedoresPageActual = 1;
    this.paginacionVendedores = null;
    this.paginacionClientesPorVendedor = new Map();
    this.paginacionItemsPorCliente = new Map();
    this.cargandoMasVendedores = false;
    this.cargandoMasClientesPorVendedor = new Set();
    this.cargandoMasItemsPorCliente = new Set();
    this.chartId = 'chart-' + this.activeVentasView + '-' + Date.now();
    this.cdr.markForCheck();
  }

  protected emitirResumenVista(): void {
    const ventaAcum = this.obtenerVentaAcumVistaActiva();
    if (ventaAcum === null) return;

    const cuota = Number(this.obtenerCuotaVistaActiva() ?? 0) || 0;
    const venta = Number(ventaAcum ?? 0) || 0;
    const proyeccion = this.tableData.reduce(
      (sum: number, item: any) => sum + (Number(item?.proyeccionVenta ?? 0) || 0),
      0,
    );

    this.resumenCambio.emit({
      ventaAcum: venta,
      cuota,
      porcCump: cuota > 0 ? (venta / cuota) * 100 : 0,
      proyeccionVenta: proyeccion,
    });
  }

  // FIX: mismo total ya calculado por pestaña (Total Cuota que ve la
  // tabla/chart) para alimentar la card KPI "Cuota Semana/Mes" del
  // dashboard padre cuando se filtra por proveedor/categoria/ciudad.
  protected obtenerCuotaVistaActiva(): number | null {
    switch (this.activeVentasView) {
      case 'proveedor':
        // Fallback: si el proveedor filtrado no tiene cuota propia asignada
        // (exactamente 0), la card debe mostrar la cuota del vendedor
        // filtrado en vez de 0. Un valor > 0 (aunque sea $1) nunca se
        // reemplaza.
        return this.totalCuotaProveedor > 0 ? this.totalCuotaProveedor : this.totalCuotaVendedor;
      case 'vendedor':
        return this.totalCuotaVendedor;
      case 'categoria':
        // Fallback: si la categoría filtrada no tiene cuota propia asignada
        // (exactamente 0), la card debe mostrar la cuota del vendedor
        // filtrado en vez de 0. Un valor > 0 (aunque sea $1) nunca se
        // reemplaza.
        return this.totalCuotaCategoria > 0 ? this.totalCuotaCategoria : this.totalCuotaVendedor;
      case 'ciudad':
      case 'cliente':
      case 'item':
        // Ciudad/Cliente/Item no tienen cuota propia: siempre mostrar la
        // cuota del/los vendedor(es) filtrado(s).
        return this.totalCuotaVendedor;
      default:
        return null;
    }
  }

  protected obtenerVentaAcumVistaActiva(): number | null {
    switch (this.activeVentasView) {
      case 'proveedor':
        return this.totalAcumuladoProveedor;
      case 'vendedor':
        return this.totalAcumuladoVendedor;
      case 'categoria':
        return this.totalAcumuladoCategoria;
      case 'ciudad':
        return this.totalAcumuladoCiudad;
      case 'cliente':
      case 'item':
        return this.totalAcumuladoVendedor;
      case 'ventas':
        // FIX: en cuota diaria el chart usa el agregado del backend
        // (totales.totalVenta / totales.ventaDiaria) para coincidir con
        // la card KPI. Reutilizamos ese mismo valor para que el evento
        // resumenCambio (que actualiza la card del dashboard padre)
        // también coincida con el chart y con la card de cuota diaria.
        if (this._tipoCuota === 'diaria' && this.totalAcumuladoVentas > 0) {
          return this.totalAcumuladoVentas;
        }
        return this.calcularVentaAcumVisible();
      default:
        return null;
    }
  }

  protected calcularVentaAcumVisible(): number {
    return this.tableData.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
      0,
    );
  }

  setVentasView(view: string): void {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.guardarVistaActiva(view);
    // OPTIMIZACION: cargar mapa de categorias solo cuando el usuario abre la pestaña categoria
    if (view === 'categoria' && this.categoriasPorId.size === 0) {
      this.cargarMapaCategorias();
    }
    this.solicitarCargaVista(true);
  }

  protected cargarVistaActivaGuardada(): string {
    const vistasValidas = new Set(this.todasLasVistas.map((vista) => vista.key));

    try {
      const vista = window.localStorage.getItem(this.activeViewStorageKey) ?? '';
      if (vistasValidas.has(vista) && this.esVistaPermitidaPorRol(vista)) {
        return vista;
      }
    } catch {
      // Ignore storage access issues and fall back to the default view.
    }

    return this.rolId === RoleId.VENDEDOR ? 'cliente' : 'proveedor';
  }

  protected guardarVistaActiva(view: string): void {
    if (!this.esVistaPermitidaPorRol(view)) {
      return;
    }

    try {
      window.localStorage.setItem(this.activeViewStorageKey, view);
    } catch {
      // Ignore storage access issues.
    }
  }

  protected debugLog(contexto: string, detalle: string): void {
    if (!environment.production) {
      console.debug(`[${contexto}] ${detalle}`);
    }
  }

  protected construirCargaKey(): string {
    return JSON.stringify({
      view: this.activeVentasView,
      codigoVendedor: this._codigoVendedor,
      codigosVendedores: this._codigosVendedoresPermitidos,
      tipoCuota: this._tipoCuota,
      filtros: this._filtros,
    });
  }

  protected solicitarCargaVista(force = false): void {
    console.debug('[Ventas] solicitarCargaVista called', {
      codigoVendedor: this._codigoVendedor,
      esModoAdminTodos: this.esModoAdminTodos(),
      iniciado: this.iniciado,
      force,
    });
    if ((!this._codigoVendedor && !this.esModoAdminTodos()) || !this.iniciado) {
      console.debug('[Ventas] solicitarCargaVista => omitted, condition not met', {
        codigoVendedor: this._codigoVendedor,
        esModoAdminTodos: this.esModoAdminTodos(),
        iniciado: this.iniciado,
      });
      return;
    }

    this.cargaForzadaPendiente = this.cargaForzadaPendiente || force;

    if (this.cargaProgramada) return;

    this.cargaProgramada = true;

    queueMicrotask(() => {
      const forceCarga = this.cargaForzadaPendiente;
      this.cargaForzadaPendiente = false;
      this.cargaProgramada = false;
      this.cargarVistaActual(forceCarga);
    });
  }

  protected esModoAdminTodos(): boolean {
    return this._modoAdmin && (!this._codigoVendedor || this._codigoVendedor === 'ALL');
  }

  protected tieneCodigosVendedoresPermitidos(): boolean {
    return this._codigosVendedoresPermitidos.length > 0;
  }

  protected filtrarPorCodigosVendedoresPermitidos(listado: any[]): any[] {
    if (!this.tieneCodigosVendedoresPermitidos()) {
      return listado;
    }

    return listado.filter((item: any) => {
      const valoresFila = [
        item?.codVendedor,
        item?.codigo_vendedor,
        item?.codigoVendedor,
        item?.cod,
        item?.codigo,
        item?.id_vendedor,
        item?.idVendedor,
      ]
        .map((valor) => this.normalizarCodigoVendedor(valor))
        .filter(Boolean);

      return valoresFila.some((codigo) => this._codigosVendedoresPermitidos.includes(codigo));
    });
  }

  protected filtrarCodigosPermitidos(codigos: string[]): string[] {
    if (!this.tieneCodigosVendedoresPermitidos()) {
      return codigos;
    }

    return codigos.filter((codigo) =>
      this._codigosVendedoresPermitidos.includes(this.normalizarCodigoVendedor(codigo)),
    );
  }

  protected combinarResultadosPorVendedor<T>(
    codigos: string[],
    cargador: (codigo: string) => Observable<any>,
    extraer: (res: any) => T[],
  ): Observable<T[]> {
    const solicitudes = codigos.map((codigo) => cargador(codigo).pipe(map((res) => extraer(res))));

    return forkJoin(solicitudes).pipe(map((listas) => listas.flat()));
  }

  protected abstract normalizarCodigoVendedor(valor: unknown): string;
  protected abstract cargarMapaCategorias(): void;
  protected abstract cargarVistaActual(force?: boolean): void;
}
