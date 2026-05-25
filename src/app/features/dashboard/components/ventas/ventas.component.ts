import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin, merge, of, Subject, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { ChartComponent } from '../../../../shared/components/chart';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { AuthService } from '../../../../core/services/auth.service';
import { TipoCuota } from '../../../cumplimientos-cuota/cumplimientos.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent, TableComponent],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentasComponent implements OnInit, OnDestroy {
  private cumplimientoService = inject(CumplimientoService);
  private semanaService = inject(CumplimientoSemanaService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  private readonly activeViewStorageKey = 'sigc-dd.dashboard.ventas.activeView';

  @Input() set codigoVendedor(value: string) {
    this._codigoVendedor = this.normalizarCodigoVendedor(value);
    console.debug('[Ventas][setter] codigoVendedor set =>', value, 'normalized=>', this._codigoVendedor, 'iniciado=>', this.iniciado, 'esModoAdminTodos=>', this.esModoAdminTodos());
    if ((value || this.esModoAdminTodos()) && this.iniciado) {
      this.solicitarCargaVista();
    }
  }
  get codigoVendedor(): string {
    return this._codigoVendedor;
  }
  private _codigoVendedor = '';

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
  private _modoAdmin = false;

  @Input() set vendedoresDetalle(value: any[] | null | undefined) {
    this._vendedoresDetalle = Array.isArray(value) ? value : [];

    if (this.iniciado && this.esModoAdminTodos() && this.activeVentasView === 'cliente') {
      this.solicitarCargaVista(true);
    }
  }
  get vendedoresDetalle(): any[] {
    return this._vendedoresDetalle;
  }
  private _vendedoresDetalle: any[] = [];

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
  private _codigosVendedoresPermitidos: string[] = [];

  @Input() set tipoCuota(value: TipoCuota) {
    const cambio = this._tipoCuota !== value;
    this._tipoCuota = value;

    if (cambio && this._codigoVendedor && this.iniciado) {
      this.solicitarCargaVista(true);
    }
  }
  get tipoCuota(): TipoCuota {
    return this._tipoCuota;
  }
  private _tipoCuota: TipoCuota = 'mensual';

  @Input() set filtros(value: DashboardFilters) {
    this._filtros = value;
    console.debug('[Ventas][setter] filtros set =>', value, 'codigoVendedor=>', this._codigoVendedor, 'esModoAdminTodos=>', this.esModoAdminTodos(), 'iniciado=>', this.iniciado);
    if ((this._codigoVendedor || this.esModoAdminTodos()) && this.iniciado) {
      this.solicitarCargaVista();
    }
  }
  get filtros(): DashboardFilters {
    return this._filtros;
  }
  private _filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    ciudadNombre: '',
    linea: '',
  };

  private destroy$ = new Subject<void>();
  private recargarVista$ = new Subject<void>();
  private iniciado = false;
  private cargaProgramada = false;
  private cargaForzadaPendiente = false;
  private ultimaCargaKey = '';

  rolId = 0;
  activeVentasView = 'ventas';
  chartId = 'chart-main';
  chartType: 'line' | 'bar' | 'pie' = 'line';
  tableData: any[] = [];
  chartData: any[] = [];
  private allItemData: any[] = [];
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
  liderVentasProveedor = '—';
  private categoriasPorId = new Map<string, string>();

  private readonly clientesPageSize = 30;
  private readonly productosPageSize = 25;
  private clientesVisibles = this.clientesPageSize;
  private readonly productosVisiblesPorCliente: Record<string, number> = {};

  private readonly todasLasVistas = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'categoria', label: 'Por Categoría' },
    { key: 'ciudad', label: 'Por Ciudad' },
    { key: 'cliente', label: 'Detalle por Cliente' },
    { key: 'vendedor', label: 'Por Vendedor' },
    { key: 'item', label: 'Detalle por Item' },
  ];

  get ventasViews() {
    if (this.rolId === 1 || this.rolId === 2) {
      // Para admin y supervisor: quitar 'ventas' y poner 'vendedor' primero
      const filtered = this.todasLasVistas.filter((v) => v.key !== 'ventas');
      const vendedorIndex = filtered.findIndex((v) => v.key === 'vendedor');
      if (vendedorIndex > 0) {
        const vendedor = filtered.splice(vendedorIndex, 1)[0];
        filtered.unshift(vendedor);
      }
      return filtered;
    } else if (this.rolId === 3) {
      return this.todasLasVistas.filter((v) => v.key !== 'ventas' && v.key !== 'vendedor');
    }
    return this.todasLasVistas;
  }

  private esVistaPermitidaPorRol(vista: string): boolean {
    if (this.rolId === 3) {
      return vista !== 'ventas' && vista !== 'vendedor';
    }

    if (this.rolId === 1 || this.rolId === 2) {
      return vista !== 'ventas';
    }

    return true;
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
    this.activeVentasView = this.cargarVistaActivaGuardada();
  }

  ngOnInit(): void {
    this.iniciado = true;
    this.cargarMapaCategorias();
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

  private resetearVista(): void {
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
    this.liderVentasProveedor = '—';
    this.clientesVisibles = this.clientesPageSize;
    this.chartId = 'chart-' + this.activeVentasView + '-' + Date.now();
    this.cdr.markForCheck();
  }

  setVentasView(view: string): void {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.guardarVistaActiva(view);
    this.solicitarCargaVista(true);
  }

  private cargarVistaActivaGuardada(): string {
    const vistasValidas = new Set(this.todasLasVistas.map((vista) => vista.key));

    try {
      const vista = window.localStorage.getItem(this.activeViewStorageKey) ?? '';
      if (vistasValidas.has(vista) && this.esVistaPermitidaPorRol(vista)) {
        return vista;
      }
    } catch {
      // Ignore storage access issues and fall back to the default view.
    }

    return this.rolId === 3 ? 'cliente' : 'proveedor';
  }

  private guardarVistaActiva(view: string): void {
    if (!this.esVistaPermitidaPorRol(view)) {
      return;
    }

    try {
      window.localStorage.setItem(this.activeViewStorageKey, view);
    } catch {
      // Ignore storage access issues.
    }
  }

  private debugLog(contexto: string, detalle: string): void {
    if (!environment.production) {
      console.debug(`[${contexto}] ${detalle}`);
    }
  }

  private construirCargaKey(): string {
    return JSON.stringify({
      view: this.activeVentasView,
      codigoVendedor: this._codigoVendedor,
      codigosVendedores: this._codigosVendedoresPermitidos,
      tipoCuota: this._tipoCuota,
      filtros: this._filtros,
    });
  }

  private solicitarCargaVista(force = false): void {
    console.debug('[Ventas] solicitarCargaVista called', { codigoVendedor: this._codigoVendedor, esModoAdminTodos: this.esModoAdminTodos(), iniciado: this.iniciado, force });
    if ((!this._codigoVendedor && !this.esModoAdminTodos()) || !this.iniciado) {
      console.debug('[Ventas] solicitarCargaVista => omitted, condition not met', { codigoVendedor: this._codigoVendedor, esModoAdminTodos: this.esModoAdminTodos(), iniciado: this.iniciado });
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

  private esModoAdminTodos(): boolean {
    return this._modoAdmin && (!this._codigoVendedor || this._codigoVendedor === 'ALL');
  }

  private tieneCodigosVendedoresPermitidos(): boolean {
    return this._codigosVendedoresPermitidos.length > 0;
  }

  private filtrarPorCodigosVendedoresPermitidos(listado: any[]): any[] {
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

  private filtrarCodigosPermitidos(codigos: string[]): string[] {
    if (!this.tieneCodigosVendedoresPermitidos()) {
      return codigos;
    }

    return codigos.filter((codigo) =>
      this._codigosVendedoresPermitidos.includes(this.normalizarCodigoVendedor(codigo)),
    );
  }

  private combinarResultadosPorVendedor<T>(
    codigos: string[],
    cargador: (codigo: string) => Observable<any>,
    extraer: (res: any) => T[],
  ): Observable<T[]> {
    const solicitudes = codigos.map((codigo) => cargador(codigo).pipe(map((res) => extraer(res))));

    return forkJoin(solicitudes).pipe(map((listas) => listas.flat()));
  }

  private consolidarPorLinea(lineas: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const item of lineas) {
      const linea = String(item?.linea ?? '').trim();
      if (!linea) continue;

      const existente = mapa.get(linea);
      if (!existente) {
        mapa.set(linea, {
          ...item,
          cuotaLinea: Number(item?.cuotaLinea ?? 0),
          ventaAcum: Number(item?.ventaAcum ?? 0),
          proyeccionVenta: Number(item?.proyeccionVenta ?? 0),
        });
      } else {
        existente.cuotaLinea += Number(item?.cuotaLinea ?? 0);
        existente.ventaAcum += Number(item?.ventaAcum ?? 0);
        existente.proyeccionVenta += Number(item?.proyeccionVenta ?? 0);
      }
    }

    return Array.from(mapa.values()).map((row) => ({
      ...row,
      porcCump: row.cuotaLinea > 0 ? (row.ventaAcum / row.cuotaLinea) * 100 : 0,
      porcCumProy: row.cuotaLinea > 0 ? (row.proyeccionVenta / row.cuotaLinea) * 100 : 0,
    }));
  }

  private consolidarPorCategoria(categorias: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const item of categorias) {
      const idCategoria = String(
        item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '',
      ).trim();
      const categoriaBase = this.obtenerNombreCategoria(item);
      const categoria = this.repararTextoCiudad(
        categoriaBase ||
          String(item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? idCategoria).trim(),
      ).trim();
      const key = categoria || idCategoria;

      if (!key) continue;

      const existente = mapa.get(key);
      if (!existente) {
        mapa.set(key, {
          ...item,
          id_categoria: idCategoria || item?.id_categoria || item?.idCategoria || item?.categoria_id,
          categoria: categoria || idCategoria || 'Sin categoría',
          cuota: Number(item?.cuota ?? 0),
          acumulado: Number(item?.acumulado ?? item?.ventaAcum ?? 0),
          ventaAcum: Number(item?.acumulado ?? item?.ventaAcum ?? 0),
          proyeccionVenta: Number(item?.proyeccionVenta ?? 0),
        });
      } else {
        existente.cuota += Number(item?.cuota ?? 0);
        existente.acumulado += Number(item?.acumulado ?? item?.ventaAcum ?? 0);
        existente.ventaAcum += Number(item?.acumulado ?? item?.ventaAcum ?? 0);
        existente.proyeccionVenta += Number(item?.proyeccionVenta ?? 0);
      }
    }

    return Array.from(mapa.values()).map((row) => ({
      ...row,
      porcCump: row.cuota > 0 ? (row.ventaAcum / row.cuota) * 100 : 0,
      porcCumProy: row.cuota > 0 ? (row.proyeccionVenta / row.cuota) * 100 : 0,
    }));
  }

  private consolidarPorCiudad(ciudades: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const item of ciudades) {
      const ciudad = this.repararTextoCiudad(item?.ciudad ?? '');
      if (!ciudad || this.esCiudadResumen(ciudad)) continue;

      const existente = mapa.get(ciudad);
      if (!existente) {
        mapa.set(ciudad, {
          ...item,
          ciudad,
          cuota: Number(item?.cuota ?? item?.cuotaCiudad ?? 0),
          ventaAcum: Number(item?.ventaAcum ?? 0),
          proyeccionVenta: Number(item?.proyeccionVenta ?? 0),
        });
      } else {
        existente.cuota += Number(item?.cuota ?? item?.cuotaCiudad ?? 0);
        existente.ventaAcum += Number(item?.ventaAcum ?? 0);
        existente.proyeccionVenta += Number(item?.proyeccionVenta ?? 0);
      }
    }

    return Array.from(mapa.values()).map((row) => ({
      ...row,
      porcCump: row.cuota > 0 ? (row.ventaAcum / row.cuota) * 100 : 0,
      porcCumProy: row.cuota > 0 ? (row.proyeccionVenta / row.cuota) * 100 : 0,
    }));
  }

  private obtenerCuotaNumero(row: any): number {
    const valor =
      row?.[this.cuotaColumn] ??
      row?.cuotaMes ??
      row?.cuotaSemana ??
      row?.cuotaDiaria ??
      row?.cuota ??
      row?.cuotaLinea ??
      0;

    if (typeof valor === 'object' && valor) {
      const cuotaObj = this.esSemanal
        ? Number(valor?.cuota_semana ?? 0)
        : this._tipoCuota === 'diaria'
          ? Number(valor?.cuota_dia ?? 0)
          : Number(valor?.cuota_mes ?? 0);
      return Number.isFinite(cuotaObj) ? cuotaObj : 0;
    }

    const cuotaNum = Number(valor);
    return Number.isFinite(cuotaNum) ? cuotaNum : 0;
  }

  private mapearDetalleAdminAVendedores(detalle: any[]): any[] {
    return detalle
      .filter(
        (row: any) => String(row?.codVendedor ?? row?.codigo_vendedor ?? '').trim() !== 'TOTALES',
      )
      .map((row: any) => ({
        ...row,
        codVendedor: String(row?.codVendedor ?? row?.codigo_vendedor ?? '').trim(),
        nombre: String(row?.nombre ?? ''),
        [this.cuotaColumn]: this.obtenerCuotaNumero(row),
        ventaAcum: Number(row?.ventaAcum ?? 0) || 0,
        porcCump: Number(row?.porcCump ?? 0) || 0,
        proyeccionVenta: Number(row?.proyeccionVenta ?? 0) || 0,
        porcCumProy:
          this.obtenerCuotaNumero(row) > 0
            ? ((Number(row?.proyeccionVenta ?? 0) || 0) / this.obtenerCuotaNumero(row)) * 100
            : 0,
      }));
  }


  private pintarVistaVendedor(
    detalleVendedores: any[],
    filtrosConsulta: DashboardFilters,
    chartPrefix = 'chart-vendedor',
  ): void {
    this.chartType = 'bar';

    const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
    const vendedoresFiltrados = codigoVendedorFiltro
      ? this.filtrarVendedores(detalleVendedores, codigoVendedorFiltro)
      : detalleVendedores;

    const vendedoresValidos = vendedoresFiltrados.filter(
      (v: any) => String(v?.codVendedor ?? v?.codigo_vendedor ?? '').trim() !== 'TOTALES',
    );

    this.tableData = [...vendedoresValidos].sort((a: any, b: any) => {
      const nombreA = String(a?.nombre ?? a?.codVendedor ?? '').trim();
      const nombreB = String(b?.nombre ?? b?.codVendedor ?? '').trim();
      return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base', numeric: true });
    });

    const topVendedores = [...vendedoresValidos]
      .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 15);

    this.totalTopVendedores = topVendedores.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    this.chartData = topVendedores.map((v: any) => {
      const codigo = String(v?.codVendedor ?? '').trim();
      const nombre = String(v?.nombre ?? '').trim();

      return {
        name: nombre || codigo || 'Vendedor',
        value: Number(v?.ventaAcum ?? 0) || 0,
      };
    });

    this.chartId = `${chartPrefix}-${Date.now()}`;
    this.cdr.markForCheck();
  }

  private agruparAdminPorCampo(detalle: any[], campo: string, campoSalida: string): any[] {
    const agg = new Map<string, any>();

    for (const row of detalle) {
      const keyRaw = String(row?.[campo] ?? '').trim() || 'Sin dato';
      const key = this.repararTextoCiudad(keyRaw);
      const cuota = this.obtenerCuotaNumero(row);
      const ventaAcum = Number(row?.ventaAcum ?? 0) || 0;
      const proyeccionVenta = Number(row?.proyeccionVenta ?? 0) || 0;

      const actual = agg.get(key) ?? {
        [campoSalida]: key,
        cuotaLinea: 0,
        cuota: 0,
        ventaAcum: 0,
        acumulado: 0,
        proyeccionVenta: 0,
      };

      actual.cuotaLinea += cuota;
      actual.cuota += cuota;
      actual.ventaAcum += ventaAcum;
      actual.acumulado += ventaAcum;
      actual.proyeccionVenta += proyeccionVenta;

      agg.set(key, actual);
    }

    return Array.from(agg.values()).map((row) => ({
      ...row,
      porcCump: row.cuotaLinea > 0 ? (row.ventaAcum / row.cuotaLinea) * 100 : 0,
      porcentajeCumplimiento: row.cuota > 0 ? (row.acumulado / row.cuota) * 100 : 0,
      part: 0,
      proyectado: row.proyeccionVenta,
      porcCumProy: row.cuotaLinea > 0 ? (row.proyeccionVenta / row.cuotaLinea) * 100 : 0,
      porcentajeCumplimientoProyectado: row.cuota > 0 ? (row.proyeccionVenta / row.cuota) * 100 : 0,
    }));
  }

  private cargarVistaAdminTodos(filtrosConsulta: DashboardFilters): void {
    const filtrosAdmin =
      this.activeVentasView === 'ciudad'
        ? { ...filtrosConsulta, vendedor: '' }
        : filtrosConsulta;

    const admin$ = this.esSemanal
      ? this.semanaService.getCumplimientoSemanaAdmin(filtrosAdmin)
      : this.cumplimientoService.getCumplimientoMesAdmin(filtrosAdmin);

    switch (this.activeVentasView) {
      case 'categoria':
        this.chartType = 'bar';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigos = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              (this.esSemanal
                ? this.semanaService.getCuotaCategoriaPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getCuotaCategoriaPorVendedor(codigo, filtrosConsulta)),
            (res) => (Array.isArray(res?.detalle) ? res.detalle : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((detalleBruto: any[]) => {
              const detalleConsolidado = this.consolidarPorCategoria(detalleBruto);
              const detalleFiltrado = this.filtrarCategorias(detalleConsolidado, filtrosConsulta.categoria);
              const detalleConNombre = detalleFiltrado.map((item: any) => ({
                ...item,
                categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
              }));
              const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleConNombre);

              this.tableData = detalleOrdenado;
              this.totalCuotaCategoria = detalleOrdenado.reduce(
                (sum: number, item: any) => sum + (Number(item?.cuota ?? 0) || 0),
                0,
              );
              this.totalAcumuladoCategoria = detalleOrdenado.reduce(
                (sum: number, item: any) =>
                  sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                0,
              );

              const topCategorias = [...detalleConNombre]
                .map((i: any) => ({
                  name: this.obtenerNombreCategoria(i) || 'Sin categoría',
                  value: Number(i?.acumulado ?? i?.ventaAcum ?? 0),
                }))
                .sort((a: any, b: any) => b.value - a.value)
                .slice(0, 15);

              this.totalTopCategorias = topCategorias.reduce(
                (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
                0,
              );
              this.chartData = topCategorias;
              this.chartId = 'chart-categoria-admin-' + Date.now();
              this.cdr.markForCheck();
            });
          return;
        }
        this.cumplimientoService
          .getCuotaCategoriaGeneral(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const pintarCategoria = (detalleRaw: any[]) => {
              const detallePermitido = this.filtrarPorCodigosVendedoresPermitidos(detalleRaw);
              const detalleFiltrado = this.filtrarCategorias(detallePermitido, filtrosConsulta.categoria);
              const detalleConNombre = detalleFiltrado.map((item: any) => ({
                ...item,
                categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
              }));
              const detalleCompleto = this.completarCategoriasSinDatos(
                detalleConNombre,
                filtrosConsulta.categoria,
              );
              const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleCompleto);

              this.tableData = detalleOrdenado;
              this.totalCuotaCategoria = detalleOrdenado.reduce(
                (sum: number, item: any) => sum + (Number(item?.cuota ?? 0) || 0),
                0,
              );
              this.totalAcumuladoCategoria = detalleOrdenado.reduce(
                (sum: number, item: any) =>
                  sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                0,
              );

              const topCategorias = [...detalleCompleto]
                .map((i: any) => ({
                  name: this.obtenerNombreCategoria(i) || 'Sin categoría',
                  value: Number(i?.acumulado ?? i?.ventaAcum ?? 0),
                }))
                .sort((a: any, b: any) => b.value - a.value)
                .slice(0, 15);

              this.totalTopCategorias = topCategorias.reduce(
                (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
                0,
              );
              this.chartData = topCategorias;
              this.chartId = 'chart-categoria-admin-' + Date.now();
              this.cdr.markForCheck();
            };

            const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
            if (detalle.length > 0) {
              pintarCategoria(detalle);
              return;
            }

            this.cumplimientoService
              .getCuotaCategoriasPorVendedores(filtrosConsulta)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((fallback: any) => {
                const detalleFallback = Array.isArray(fallback?.detalle) ? fallback.detalle : [];
                pintarCategoria(detalleFallback);
              });
          });
        return;

      case 'proveedor':
        this.chartType = 'bar';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigos = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              (this.esSemanal
                ? this.semanaService.getLineasPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getLineasPorVendedor(codigo, filtrosConsulta)),
            (res) => (Array.isArray(res?.detallePorLinea) ? res.detallePorLinea : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((lineas: any[]) => {
              const detalleMapeado = lineas.map((item: any) => ({
                ...item,
                linea: item?.linea ?? item?.codigoLinea ?? item?.reporteProvConObs ?? 'Sin proveedor',
                cuotaLinea: Number(item?.cuotaProveedorTotal ?? 0) || 0,
                ventaAcum: Number(item?.ventaAcum ?? 0) || 0,
                porcCump: Number(item?.porcCump ?? 0) || 0,
                proyeccionVenta: Number(item?.proyeccionVenta ?? 0) || 0,
                porcCumProy: Number(item?.porcCumProy ?? 0) || 0,
              }));

              const detalleConsolidado = this.consolidarPorLinea(detalleMapeado);
              const filtrado = this.filtrarProveedores(detalleConsolidado, filtrosConsulta.proveedor);
              const ordenado = this.ordenarProveedoresPorAlfabeto(filtrado);

              this.tableData = ordenado;
              this.totalCuotaProveedor = ordenado.reduce(
                (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                0,
              );
              this.totalAcumuladoProveedor = ordenado.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );

              const topProveedores = [...ordenado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);

              this.totalTopProveedores = topProveedores.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.liderVentasProveedor = topProveedores[0]?.linea ?? '—';

              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea ?? 'Sin dato',
                value: Number(i?.ventaAcum ?? 0),
              }));
              this.chartId = 'chart-proveedor-admin-' + Date.now();
              this.cdr.markForCheck();
            });
          return;
        }
        this.cumplimientoService
          .getLineasAdmin(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const lineas = Array.isArray(res?.detallePorLinea) ? res.detallePorLinea : [];
            const lineasPermitidas = this.filtrarPorCodigosVendedoresPermitidos(lineas);
            
            // Mapear campos del endpoint a formato de tabla
            const detalleMapeado = lineasPermitidas.map((item: any) => ({
              ...item,
              linea: item?.linea ?? item?.codigoLinea ?? item?.reporteProvConObs ?? 'Sin proveedor',
              cuotaLinea: Number(item?.cuotaProveedorTotal ?? 0) || 0,
              ventaAcum: Number(item?.ventaAcum ?? 0) || 0,
              porcCump: Number(item?.porcCump ?? 0) || 0,
              proyeccionVenta: Number(item?.proyeccionVenta ?? 0) || 0,
              porcCumProy: Number(item?.porcCumProy ?? 0) || 0,
            }));
            
            const filtrado = this.filtrarProveedores(detalleMapeado, filtrosConsulta.proveedor);
            const ordenado = this.ordenarProveedoresPorAlfabeto(filtrado);

            this.tableData = ordenado;
            this.totalCuotaProveedor = ordenado.reduce(
              (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
              0,
            );
            this.totalAcumuladoProveedor = ordenado.reduce(
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
              0,
            );

            const topProveedores = [...ordenado]
              .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
              .slice(0, 12);

            this.totalTopProveedores = topProveedores.reduce(
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
              0,
            );
            this.liderVentasProveedor = topProveedores[0]?.linea ?? '—';

            this.chartData = topProveedores.map((i: any) => ({
              name: i.linea ?? 'Sin dato',
              value: Number(i?.ventaAcum ?? 0),
            }));
            this.chartId = 'chart-proveedor-admin-' + Date.now();
            this.cdr.markForCheck();
          });
        return;

      case 'ciudad':
        this.chartType = 'pie';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigos = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              (this.esSemanal
                ? this.semanaService.getCiudadesPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getCiudadesPorVendedor(codigo, filtrosConsulta)),
            (res) => (Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((ciudadesRaw: any[]) => {
              if (!ciudadesRaw.length) {
                this.tableData = [];
                this.chartData = [];
                this.cdr.markForCheck();
                return;
              }

              const consolidado = this.consolidarPorCiudad(ciudadesRaw);

              const filtrado = this.filtrarPorCiudadSeleccionada(consolidado);
              const ordenado = [...filtrado].sort((a: any, b: any) =>
                this.repararTextoCiudad(a?.ciudad).localeCompare(
                  this.repararTextoCiudad(b?.ciudad),
                  'es',
                ),
              );
              const topCiudades = [...filtrado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 15);

              this.tableData = ordenado;
              this.totalTopCiudades = topCiudades.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.chartData = topCiudades.map((i: any) => ({
                name: this.repararTextoCiudad(i?.ciudad),
                value: Number(i?.ventaAcum ?? 0),
              }));
              this.chartId = 'chart-ciudad-admin-' + Date.now();
              this.cdr.markForCheck();
            });
          return;
        }
        this.cumplimientoService
          .getCiudadesGlobal(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const ciudadesRaw = Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
            const ciudadesPermitidas = this.filtrarPorCodigosVendedoresPermitidos(ciudadesRaw);

            if (!ciudadesPermitidas.length) {
              this.tableData = [];
              this.chartData = [];
              this.cdr.markForCheck();
              return;
            }

            const consolidado = ciudadesPermitidas
              .map((row: any) => {
                const ciudad = this.repararTextoCiudad(
                  row?.ciudad ?? row?.nomCiudad ?? row?.nombreCiudad ?? '',
                );
                const cuota =
                  Number(row?.cuotaCiudad ?? row?.cuotaCiudadTotal ?? row?.cuota ?? 0) || 0;
                const ventaAcum = Number(row?.ventaAcum ?? 0) || 0;
                const proyeccionVenta = Number(row?.proyeccionVenta ?? 0) || 0;

                return {
                  ciudad,
                  cuota,
                  ventaAcum,
                  proyeccionVenta,
                  porcCump:
                    Number(row?.porcCumpCiudad ?? row?.porcCump ?? 0) ||
                    (cuota > 0 ? (ventaAcum / cuota) * 100 : 0),
                  porcCumProy:
                    Number(row?.porcCumProyGlobal ?? row?.porcCumProy ?? 0) ||
                    (cuota > 0 ? (proyeccionVenta / cuota) * 100 : 0),
                };
              })
              .filter((item: any) => item?.ciudad && !this.esCiudadResumen(item?.ciudad));

            const filtrado = this.filtrarPorCiudadSeleccionada(consolidado);
            const ordenado = [...filtrado].sort((a: any, b: any) =>
              this.repararTextoCiudad(a?.ciudad).localeCompare(this.repararTextoCiudad(b?.ciudad), 'es'),
            );
            const topCiudades = [...filtrado]
              .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
              .slice(0, 15);

            this.tableData = ordenado;
            this.totalTopCiudades = topCiudades.reduce(
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
              0,
            );
            this.chartData = topCiudades.map((i: any) => ({
              name: this.repararTextoCiudad(i?.ciudad),
              value: Number(i?.ventaAcum ?? 0),
            }));
            this.chartId = 'chart-ciudad-admin-' + Date.now();
            this.cdr.markForCheck();
          });
        return;

      case 'item':
      case 'cliente':
        this.chartType = 'bar';

        if (this.activeVentasView === 'cliente') {
          this.cargarDetalleClientesAdministrador(filtrosConsulta);
          return;
        }

        this.cumplimientoService
          .getVendedores()
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((vendedores: any[]) => {
            const codigos = this.filtrarCodigosPermitidos(
              (Array.isArray(vendedores) ? vendedores : [])
                .map((v: any) =>
                  String(v?.codigo_vendedor ?? v?.codVendedor ?? v?.codigo ?? '').trim(),
                )
                .filter(Boolean),
            );

            if (!codigos.length) {
              this.tableData = [];
              this.chartData = [];
              this.cdr.markForCheck();
              return;
            }

            const calls = codigos.map((codigo) =>
              this.cumplimientoService.getProductosPorVendedor(codigo, filtrosConsulta),
            );

            forkJoin(calls)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((responses: any[]) => {
                const listado = responses.flatMap((r: any) =>
                  Array.isArray(r?.data) ? r.data : [],
                );
                const listadoOrdenado = this.ordenarDetalleItemsPorFechaAsc(listado);
                this.allItemData = listadoOrdenado;
                this.tableData = [...listadoOrdenado];
                this.recalcularChart();
              });
          });
        return;

      default:
        admin$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
          const detalle = this.filtrarPorCodigosVendedoresPermitidos(
            this.mapearDetalleAdminAVendedores(res?.detalle ?? []),
          );

          switch (this.activeVentasView) {
            case 'ventas':
            case 'vendedor': {
              this.chartType = this.activeVentasView === 'ventas' ? 'line' : 'bar';

              // Aplicar filtro de vendedor si está seleccionado
              const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
              const vendedoresFiltrados = codigoVendedorFiltro
                ? this.filtrarVendedores(detalle, codigoVendedorFiltro)
                : detalle;

              this.tableData = vendedoresFiltrados;
              const venta = vendedoresFiltrados.reduce(
                (s: number, r: any) => s + (Number(r?.ventaAcum ?? 0) || 0),
                0,
              );
              const cuota = vendedoresFiltrados.reduce(
                (s: number, r: any) => s + (Number(r?.[this.cuotaColumn] ?? 0) || 0),
                0,
              );
              const proyeccion = vendedoresFiltrados.reduce(
                (s: number, r: any) => s + (Number(r?.proyeccionVenta ?? 0) || 0),
                0,
              );

              if (this.activeVentasView === 'ventas') {
                this.chartData = [
                  { name: 'Venta', value: venta },
                  { name: 'Cuota', value: cuota },
                  { name: 'Proyección', value: proyeccion },
                ];
              } else {
                this.pintarVistaVendedor(vendedoresFiltrados, filtrosConsulta, 'chart-vendedor-admin');
                return;
              }
              break;
            }

            case 'proveedor': {
              this.chartType = 'bar';
              const agrupado = this.agruparAdminPorCampo(detalle, 'linea', 'linea');

              // Aplicar filtro de proveedor si está seleccionado
              const codigoProveedorFiltro = String(filtrosConsulta.proveedor ?? '').trim();
              const proveedoresFiltrados = codigoProveedorFiltro
                ? this.filtrarProveedores(agrupado, codigoProveedorFiltro)
                : agrupado;

              const ordenado = this.ordenarProveedoresPorAlfabeto(proveedoresFiltrados);
              const topProveedores = [...proveedoresFiltrados]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);

              this.totalTopProveedores = topProveedores.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.liderVentasProveedor = this.nombreProveedorCard(topProveedores[0]?.linea ?? '—');
              this.tableData = ordenado;
              this.totalCuotaProveedor = this.tableData.reduce(
                (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                0,
              );
              this.totalAcumuladoProveedor = this.tableData.reduce(
                (sum: number, item: any) =>
                  sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea,
                value: i.ventaAcum,
              }));
              break;
            }

            case 'ciudad': {
              this.chartType = 'pie';
              const agrupado = this.agruparAdminPorCampo(detalle, 'ciudad', 'ciudad').map(
                (r: any) => ({
                  ...r,
                  ciudad: this.repararTextoCiudad(r?.ciudad),
                }),
              );
              const filtrado = this.filtrarPorCiudadSeleccionada(agrupado);
              const ordenado = [...filtrado].sort((a: any, b: any) =>
                this.repararTextoCiudad(a?.ciudad).localeCompare(
                  this.repararTextoCiudad(b?.ciudad),
                  'es',
                ),
              );
              const topCiudades = [...filtrado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 15);

              this.tableData = ordenado;
              this.totalTopCiudades = topCiudades.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.chartData = topCiudades.map((i: any) => ({
                name: this.repararTextoCiudad(i.ciudad),
                value: i.ventaAcum,
              }));
              break;
            }
          }

          this.cdr.markForCheck();
        });
    }
  }

  private recalcularChart(): void {
    const agg = new Map<string, { subtotal: number }>();

    for (const row of this.allItemData) {
      const key = row.Descripcion ?? 'SIN DESCRIPCION';
      const actual = agg.get(key) ?? { subtotal: 0 };
      actual.subtotal += this.calcularVentaRow(row);
      agg.set(key, actual);
    }

    const topItems = Array.from(agg.entries())
      .map(([name, value]) => ({ name, value: Number(value?.subtotal ?? 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    this.totalTopItemsSubtotal = topItems.reduce(
      (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
      0,
    );
    this.chartData = topItems;

    this.chartId = 'chart-item-' + Date.now();
    this.cdr.markForCheck();
  }

  private obtenerNombreCliente(row: any): string {
    const nombre =
      row?.cliente ??
      row?.razon_social ??
      row?.razonSocial ??
      row?.nombre_establecimiento ??
      row?.nombreEstablecimiento ??
      row?.Cliente ??
      row?.nombreCliente ??
      row?.Nombre_Cliente ??
      row?.Razon_Social ??
      '';

    return this.repararTextoCiudad(String(nombre).trim());
  }

  private obtenerSucursalCliente(row: any): string {
    const sucursal =
      row?.sucursal ??
      row?.Sucursal ??
      row?.nombre_establecimiento ??
      row?.nombreEstablecimiento ??
      row?.nombreSucursal ??
      row?.Nombre_Sucursal ??
      row?.sede ??
      row?.Sede ??
      'Sin sucursal';

    return this.repararTextoCiudad(String(sucursal).trim()) || 'Sin sucursal';
  }

  private obtenerCodigoItem(row: any): string {
    const codigo =
      row?.id_item ??
      row?.codigo_item ??
      row?.Cod_Item ??
      row?.cod_item ??
      row?.codigoItem ??
      row?.codigo ??
      '';
    return String(codigo).trim() || '—';
  }

  private obtenerIdClienteSucursal(row: any): string {
    const id =
      row?.id_cliente ?? row?.id_cliente_sucursal ?? row?.idClienteSucursal ?? row?.idCliente ?? '';
    return String(id).trim();
  }

  private obtenerDocumentoCliente(row: any): string {
    const doc =
      row?.numero_documento ??
      row?.nro_documento ??
      row?.numeroDocumento ??
      row?.documento ??
      row?.nit ??
      '';
    return String(doc).trim() || '—';
  }

  private obtenerFechaVenta(row: any): string {
    const fecha =
      row?.ultima_venta ??
      row?.ultimaVenta ??
      row?.Ultima_Venta ??
      row?.primera_venta ??
      row?.primeraVenta ??
      row?.Primera_Venta ??
      row?.fecha ??
      row?.Fecha ??
      row?.fecha_venta ??
      row?.fechaVenta ??
      row?.fecha_documento ??
      row?.fechaDocumento ??
      row?.Fecha_Documento ??
      row?.Fecha_Doc ??
      row?.createdAt ??
      row?.created_at ??
      '';
    return String(fecha).trim();
  }

  private parseFechaFlexible(fechaRaw: string): Date | null {
    const fecha = String(fechaRaw ?? '').trim();
    if (!fecha) return null;

    const soloFechaIso = /^\d{4}-\d{2}-\d{2}$/;
    if (soloFechaIso.test(fecha)) {
      const d = new Date(`${fecha}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const fechaHoraIso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;
    if (fechaHoraIso.test(fecha)) {
      const normalizada = fecha.includes('T') ? fecha : fecha.replace(' ', 'T');
      const d = new Date(normalizada);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const latino = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
    const matchLatino = fecha.match(latino);
    if (matchLatino) {
      const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = matchLatino;
      const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const intento = new Date(fecha);
    return Number.isNaN(intento.getTime()) ? null : intento;
  }

  private parseFechaOrden(fechaRaw: string): number {
    const fecha = this.parseFechaFlexible(fechaRaw);
    return fecha ? fecha.getTime() : Number.MAX_SAFE_INTEGER;
  }

  private ordenarDetalleItemsPorFechaAsc(listado: any[]): any[] {
    return [...listado].sort((a: any, b: any) => {
      const proveedorA = String(a?.Proveedor ?? a?.proveedor ?? '').trim();
      const proveedorB = String(b?.Proveedor ?? b?.proveedor ?? '').trim();
      const cmpProveedor = proveedorA.localeCompare(proveedorB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmpProveedor !== 0) return cmpProveedor;

      const descripcionA = this.obtenerDescripcionItem(a);
      const descripcionB = this.obtenerDescripcionItem(b);
      const cmpDescripcion = descripcionA.localeCompare(descripcionB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmpDescripcion !== 0) return cmpDescripcion;

      const codigoA = this.obtenerCodigoItem(a);
      const codigoB = this.obtenerCodigoItem(b);
      return codigoA.localeCompare(codigoB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });
  }

  private formatearFechaCorta(fechaIso: string): string {
    if (!fechaIso) return 'Sin fecha';
    const fecha = this.parseFechaFlexible(fechaIso);
    if (!fecha) return 'Sin fecha';
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
  }

  private obtenerInicialesCliente(nombre: string): string {
    const limpio = String(nombre ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!limpio) return 'CL';

    const partes = limpio.split(' ').slice(0, 2);
    const iniciales = partes.map((p) => p.charAt(0).toUpperCase()).join('');
    return iniciales || 'CL';
  }

  private obtenerDescripcionItem(row: any): string {
    const descripcion = row?.Descripcion ?? row?.descripcion ?? row?.producto ?? 'Sin descripción';
    return this.repararTextoCiudad(String(descripcion).trim()) || 'Sin descripción';
  }

  private obtenerCantidadItem(row: any): number {
    const cantidad =
      row?.cantidad_total ?? row?.Cantidad ?? row?.cantidad ?? row?.Venta_Unid_Cajas ?? 0;
    const num = Number(cantidad);
    return Number.isFinite(num) ? num : 0;
  }

  private obtenerPrecioUnitarioItem(row: any): number {
    const valor =
      row?.precio_unitario ?? row?.precioUnitario ?? row?.Precio_Unitario ?? row?.precio ?? 0;
    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  private calcularVentaRow(row: any): number {
    const valor =
      row?.subtotal_producto ??
      row?.subtotalProducto ??
      row?.subtotal_total ??
      row?.Subtotal ??
      row?.subTotal ??
      row?.ventaAcum ??
      row?.valorTotal ??
      0;
    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  private construirDetalleClientes(rows: any[]): any[] {
    const agg = new Map<
      string,
      {
        key: string;
        idClienteSucursal: string;
        documento: string;
        cliente: string;
        sucursal: string;
        cantidadItems: number;
        cantidadTotal: number;
        ventaAcum: number;
        expandido: boolean;
        ultimaCompra: string;
        ultimaCompraLabel: string;
        iniciales: string;
        progressItems: number;
        productos: any[];
      }
    >();

    for (const row of rows) {
      const idClienteSucursal = this.obtenerIdClienteSucursal(row);
      const cliente = this.obtenerNombreCliente(row);
      if (!cliente) continue;

      const sucursal = this.obtenerSucursalCliente(row);
      const key = idClienteSucursal || `${cliente}::${sucursal}`;

      const actual = agg.get(key) ?? {
        key,
        idClienteSucursal,
        documento: this.obtenerDocumentoCliente(row),
        cliente,
        sucursal,
        cantidadItems: 0,
        cantidadTotal: 0,
        ventaAcum: 0,
        expandido: false,
        ultimaCompra: '',
        ultimaCompraLabel: 'Sin fecha',
        iniciales: this.obtenerInicialesCliente(cliente),
        progressItems: 0,
        productos: [],
      };

      const fechaVenta = this.obtenerFechaVenta(row);
      if (fechaVenta && (!actual.ultimaCompra || fechaVenta > actual.ultimaCompra)) {
        actual.ultimaCompra = fechaVenta;
        actual.ultimaCompraLabel = this.formatearFechaCorta(fechaVenta);
        actual.documento = this.obtenerDocumentoCliente(row);
      }

      actual.cantidadItems += 1;
      actual.cantidadTotal += this.obtenerCantidadItem(row);
      actual.ventaAcum += this.calcularVentaRow(row);
      actual.productos.push({
        id_item: this.obtenerCodigoItem(row),
        fecha: fechaVenta || '—',
        numero_documento: this.obtenerDocumentoCliente(row),
        producto: this.obtenerDescripcionItem(row),
        cantidad: this.obtenerCantidadItem(row),
        precio: this.obtenerPrecioUnitarioItem(row),
        subtotal: this.calcularVentaRow(row),
        precio_unitario: this.obtenerPrecioUnitarioItem(row),
        subtotal_producto: this.calcularVentaRow(row),
      });

      agg.set(key, actual);
    }

    const resultado = Array.from(agg.values())
      .map((item) => ({
        ...item,
        productos: item.productos.sort((a, b) =>
          String(a?.producto ?? '').localeCompare(String(b?.producto ?? ''), 'es', {
            sensitivity: 'base',
            numeric: true,
          }),
        ),
      }))
      .sort((a, b) =>
        String(a?.cliente ?? '').localeCompare(String(b?.cliente ?? ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      );

    const maxItems = Math.max(1, ...resultado.map((c) => Number(c.cantidadTotal) || 0));
    return resultado.map((item) => ({
      ...item,
      progressItems: Math.max(8, Math.round(((Number(item.cantidadTotal) || 0) / maxItems) * 100)),
    }));
  }

  private extraerCodigoDesdeTexto(valor: unknown): string {
    const raw = String(valor ?? '').trim();
    if (!raw) return '';

    const match = raw.match(/^\s*(\d+)/);
    if (match?.[1]) {
      return this.normalizarCodigoVendedor(match[1]);
    }

    return this.normalizarCodigoVendedor(raw);
  }

  private obtenerCodigoVendedorDetalle(row: any): string {
    return this.normalizarCodigoVendedor(
      row?.codVendedor ??
        row?.codigo_vendedor ??
        row?.codigoVendedor ??
        row?.vendedor_codigo ??
        row?.cod_vendedor ??
        row?.codigo ??
        '',
    );
  }

  private obtenerNombreVendedorDetalle(row: any): string {
    const nombre =
      row?.nombreVendedor ??
      row?.vendedor ??
      row?.nomVendedor ??
      row?.nombre_vendedor ??
      row?.nom_vendedor ??
      row?.vendedorNombre ??
      '';

    return this.repararTextoCiudad(String(nombre).trim());
  }

  private construirDetalleClientesPorVendedor(rows: any[]): any[] {
    const grupos = new Map<
      string,
      {
        key: string;
        codVendedor: string;
        vendedor: string;
        iniciales: string;
        cantidadClientes: number;
        ventaAcum: number;
        expandido: boolean;
        clientes: any[];
      }
    >();

    for (const row of Array.isArray(rows) ? rows : []) {
      const codVendedor = this.obtenerCodigoVendedorDetalle(row);
      const nombreVendedor = this.obtenerNombreVendedorDetalle(row);

      if (!codVendedor && !nombreVendedor) continue;

      const vendedor = nombreVendedor || `Vendedor ${codVendedor}`;
      const key = codVendedor || vendedor;

      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          codVendedor,
          vendedor,
          iniciales: this.obtenerInicialesCliente(vendedor),
          cantidadClientes: 0,
          ventaAcum: 0,
          expandido: false,
          clientes: [],
        });
      }
    }

    for (const [key, grupo] of grupos.entries()) {
      const filasGrupo = rows.filter((row: any) => {
        const codigo = this.obtenerCodigoVendedorDetalle(row);
        const nombre = this.obtenerNombreVendedorDetalle(row);

        return (
          (grupo.codVendedor && codigo === grupo.codVendedor) ||
          (!grupo.codVendedor && nombre === grupo.vendedor) ||
          key === (codigo || nombre)
        );
      });

      const clientes = this.construirDetalleClientes(filasGrupo);
      grupo.clientes = clientes;
      grupo.cantidadClientes = clientes.length;
      grupo.ventaAcum = clientes.reduce(
        (sum: number, cliente: any) => sum + (Number(cliente?.ventaAcum ?? 0) || 0),
        0,
      );
    }

    return Array.from(grupos.values()).sort((a, b) =>
        String(a?.vendedor ?? '').localeCompare(String(b?.vendedor ?? ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      );
  }

  private limpiarDetalleClientesAdmin(): void {
    this.clientesAgrupados = [];
    this.clientesVista = [];
    this.totalClientesFiltrados = 0;
    this.tableData = [];
    this.chartData = [];
    this.totalTopClientes = 0;
    this.cargandoClientes = false;
    this.errorClientesMsg = '';
    this.cdr.markForCheck();
  }

  private obtenerCodigoVendedorCatalogo(vendedor: any): string {
    return this.normalizarCodigoVendedor(
      vendedor?.codVendedor ??
        vendedor?.codigo_vendedor ??
        vendedor?.codigoVendedor ??
        vendedor?.codigo ??
        vendedor?.cod ??
        '',
    );
  }

  private obtenerNombreVendedorCatalogo(vendedor: any): string {
    return this.repararTextoCiudad(
      String(
        vendedor?.nombre ??
          vendedor?.nom_vendedor ??
          vendedor?.nomVendedor ??
          vendedor?.nombreVendedor ??
          vendedor?.vendedor ??
          '',
      ).trim(),
    );
  }

  private enriquecerDetalleConVendedor(row: any, vendedor: any): any {
    const codVendedor = this.obtenerCodigoVendedorCatalogo(vendedor);
    const nombreVendedor = this.obtenerNombreVendedorCatalogo(vendedor);

    return {
      ...row,
      codVendedor:
        row?.codVendedor ??
        row?.codigo_vendedor ??
        row?.codigoVendedor ??
        row?.vendedor_codigo ??
        codVendedor,
      codigo_vendedor:
        row?.codigo_vendedor ??
        row?.codVendedor ??
        row?.codigoVendedor ??
        row?.vendedor_codigo ??
        codVendedor,
      codigoVendedor:
        row?.codigoVendedor ??
        row?.codVendedor ??
        row?.codigo_vendedor ??
        row?.vendedor_codigo ??
        codVendedor,
      vendedor:
        row?.vendedor ??
        row?.nombreVendedor ??
        row?.nomVendedor ??
        row?.nombre_vendedor ??
        nombreVendedor,
      nombreVendedor:
        row?.nombreVendedor ??
        row?.vendedor ??
        row?.nomVendedor ??
        row?.nombre_vendedor ??
        nombreVendedor,
      nomVendedor:
        row?.nomVendedor ??
        row?.nombreVendedor ??
        row?.vendedor ??
        nombreVendedor,
    };
  }

  private pintarDetalleClientesAdmin(listado: any[]): void {
    const detallePorVendedor = this.construirDetalleClientesPorVendedor(listado);

    const topVendedores = [...detallePorVendedor]
      .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 15);

    this.totalTopClientes = topVendedores.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    this.clientesAgrupados = detallePorVendedor;
    this.clientesVisibles = this.clientesPageSize;
    this.actualizarClientesVista();
    this.tableData = detallePorVendedor;
    this.chartData = topVendedores.map((vendedor: any) => ({
      name: vendedor.vendedor || vendedor.codVendedor || 'Vendedor',
      value: Number(vendedor?.ventaAcum ?? 0) || 0,
    }));

    this.chartId = 'chart-clientes-admin-' + Date.now();
    this.cargandoClientes = false;
    this.cdr.markForCheck();
  }

  private obtenerVendedoresDesdeEndpointConItems(res: any): any[] {
    if (Array.isArray(res)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: array directo', { count: res.length });
      return res;
    }
    if (Array.isArray(res?.vendedores)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .vendedores', { count: res.vendedores.length });
      return res.vendedores;
    }
    if (Array.isArray(res?.data?.vendedores)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .data.vendedores', { count: res.data.vendedores.length });
      return res.data.vendedores;
    }
    if (Array.isArray(res?.data?.rows)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .data.rows', { count: res.data.rows.length });
      return res.data.rows;
    }
    if (Array.isArray(res?.rows)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .rows', { count: res.rows.length });
      return res.rows;
    }
    if (Array.isArray(res?.data)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .data', { count: res.data.length });
      return res.data;
    }
    if (Array.isArray(res?.detalle)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .detalle', { count: res.detalle.length });
      return res.detalle;
    }
    console.error('❌ [obtenerVendedoresDesdeEndpointConItems] No se pudo extraer vendedores en ningún formato', {
      respuestaKeys: Object.keys(res ?? {}),
      esArray: Array.isArray(res),
      respuesta: res,
    });
    return [];
  }

  private obtenerClientesDesdeVendedor(vendedor: any): any[] {
    const clientes = vendedor?.clientes;
    if (Array.isArray(clientes)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: array directo', { count: clientes.length });
      return clientes;
    }
    if (Array.isArray(clientes?.data)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: .data', { count: clientes.data.length });
      return clientes.data;
    }
    if (Array.isArray(clientes?.rows)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: .rows', { count: clientes.rows.length });
      return clientes.rows;
    }
    if (Array.isArray(clientes?.detalle)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: .detalle', { count: clientes.detalle.length });
      return clientes.detalle;
    }
    console.warn('⚠️ [obtenerClientesDesdeVendedor] No se pudo extraer clientes', { vendedor });
    return [];
  }

  private obtenerItemsDesdeCliente(cliente: any): any[] {
    const items = cliente?.items;
    if (Array.isArray(items)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: array directo', { count: items.length });
      return items;
    }
    if (Array.isArray(items?.data)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: .data', { count: items.data.length });
      return items.data;
    }
    if (Array.isArray(items?.rows)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: .rows', { count: items.rows.length });
      return items.rows;
    }
    if (Array.isArray(items?.detalle)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: .detalle', { count: items.detalle.length });
      return items.detalle;
    }
    console.warn('⚠️ [obtenerItemsDesdeCliente] No se pudo extraer items', { cliente });
    return [];
  }

  private normalizarSubtotalItemEndpoint(item: any): number {
    const valor =
      item?.subtotal_producto ??
      item?.subtotalProducto ??
      item?.Subtotal ??
      item?.subtotal ??
      item?.valorTotal ??
      item?.total ??
      0;

    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  private normalizarCantidadItemEndpoint(item: any): number {
    const valor =
      item?.cantidadTotal ??
      item?.cantidad_total ??
      item?.cantidad ??
      item?.Cantidad ??
      item?.veces ??
      0;

    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  private obtenerTotalComprasClienteEndpoint(cliente: any): number {
    const valor =
      cliente?.totalCompras ??
      cliente?.total_compras ??
      cliente?.ventaAcum ??
      cliente?.subtotal_total ??
      cliente?.subtotal ??
      cliente?.total ??
      0;

    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  private vendedorCoincideConFiltro(vendedor: any, vendedorFiltro: string): boolean {
    if (!vendedorFiltro) return true;

    const valores = [
      vendedor?.codVendedor,
      vendedor?.codigo_vendedor,
      vendedor?.codigoVendedor,
      vendedor?.codigo,
      vendedor?.cod,
      vendedor?.id_vendedor,
      vendedor?.idVendedor,
      vendedor?.id,
    ]
      .map((valor) => this.normalizarCodigoVendedor(valor))
      .filter(Boolean);

    const filtroNormalizado = this.normalizarCodigoVendedor(vendedorFiltro);
    const filtroSinCeros = filtroNormalizado.replace(/^0+/, '') || filtroNormalizado;

    return valores.some((valor) => {
      const valorSinCeros = valor.replace(/^0+/, '') || valor;
      return valor === filtroNormalizado || valorSinCeros === filtroSinCeros;
    });
  }

  private mapearVendedoresConItemsComprados(res: any, filtrosConsulta: DashboardFilters): any[] {
    const vendedorFiltro = this.extraerCodigoDesdeTexto(filtrosConsulta?.vendedor);
    const vendedoresRaw = this.obtenerVendedoresDesdeEndpointConItems(res);

    console.debug('📊 [mapearVendedoresConItemsComprados] Datos recibidos:', {
      vendedoresCount: vendedoresRaw.length,
      primerVendedor: vendedoresRaw[0],
      respuestaCompleta: res,
    });

    const vendedores = vendedoresRaw
      .filter((vendedor: any) => this.vendedorCoincideConFiltro(vendedor, vendedorFiltro))
      .filter((vendedor: any) => {
        if (!this.tieneCodigosVendedoresPermitidos()) return true;

        const codigo = this.obtenerCodigoVendedorCatalogo(vendedor);
        const id = this.normalizarCodigoVendedor(vendedor?.id_vendedor ?? vendedor?.idVendedor ?? vendedor?.id);

        return (
          (codigo && this._codigosVendedoresPermitidos.includes(codigo)) ||
          (id && this._codigosVendedoresPermitidos.includes(id))
        );
      });

    return vendedores
      .map((vendedor: any) => {
        const codVendedor = this.obtenerCodigoVendedorCatalogo(vendedor);
        const idVendedor = this.normalizarCodigoVendedor(
          vendedor?.id_vendedor ?? vendedor?.idVendedor ?? vendedor?.id ?? '',
        );
        const codigoMostrar = codVendedor || idVendedor;
        const nombreVendedor = this.obtenerNombreVendedorCatalogo(vendedor) || `Vendedor ${codigoMostrar}`;
        const clientesRaw = this.obtenerClientesDesdeVendedor(vendedor);

        console.debug('👤 [Vendedor]', {
          nombre: nombreVendedor,
          clientesCount: clientesRaw.length,
          clienteExample: clientesRaw[0],
        });

        const clientes = clientesRaw
          .map((cliente: any) => {
            const itemsRaw = this.obtenerItemsDesdeCliente(cliente);
            const clienteNombre = this.repararTextoCiudad(
              String(
                cliente?.razon_social ??
                  cliente?.cliente ??
                  cliente?.nombreCliente ??
                  cliente?.nombre ??
                  '',
              ).trim(),
            );

            if (!clienteNombre) return null;

            const key = String(
              cliente?.id_cliente ??
                cliente?.idCliente ??
                cliente?.nro_documento ??
                cliente?.documento ??
                clienteNombre,
            ).trim();

            console.debug('🏪 [Cliente]', {
              nombre: clienteNombre,
              itemsCount: itemsRaw.length,
              itemExample: itemsRaw[0],
            });

            const productos = itemsRaw.map((item: any) => {
              const cantidad = this.normalizarCantidadItemEndpoint(item);
              const subtotal = this.normalizarSubtotalItemEndpoint(item);

              const productoMapeado = {
                id_item: String(item?.codigo_item ?? item?.codigoItem ?? item?.id_item ?? item?.idItem ?? '').trim() || '—',
                fecha: String(item?.fecha ?? item?.ultima_venta ?? item?.ultimaVenta ?? '—'),
                numero_documento: String(cliente?.nro_documento ?? cliente?.numero_documento ?? cliente?.documento ?? '—'),
                producto: this.repararTextoCiudad(
                  String(item?.descripcion ?? item?.producto ?? item?.Descripcion ?? 'Sin descripción').trim(),
                ),
                cantidad,
                precio: Number(item?.precio_promedio_ponderado ?? item?.precioPromedioPonderado ?? item?.precio_unitario ?? 0) || 0,
                subtotal,
                precio_unitario: Number(item?.precio_promedio_ponderado ?? item?.precioPromedioPonderado ?? item?.precio_unitario ?? 0) || 0,
                subtotal_producto: subtotal,
              };

              console.debug('📦 [Producto mapeado]', productoMapeado);

              return productoMapeado;
            });

            const cantidadTotal = productos.reduce(
              (sum: number, item: any) => sum + (Number(item?.cantidad ?? 0) || 0),
              0,
            );
            const totalCompras = this.obtenerTotalComprasClienteEndpoint(cliente);
            const ultimaCompra = String(
              cliente?.ultimaCompra ?? cliente?.ultima_compra ?? cliente?.ultima_venta ?? cliente?.fecha ?? '',
            ).trim();

            return {
              key,
              idClienteSucursal: key,
              documento: String(cliente?.nro_documento ?? cliente?.numero_documento ?? cliente?.documento ?? '—'),
              cliente: clienteNombre,
              sucursal: this.repararTextoCiudad(String(cliente?.sucursal ?? cliente?.sede ?? 'Sin sucursal')),
              cantidadItems: productos.length,
              cantidadTotal,
              ventaAcum: totalCompras,
              expandido: false,
              ultimaCompra,
              ultimaCompraLabel: ultimaCompra ? this.formatearFechaCorta(ultimaCompra) : 'Sin fecha',
              iniciales: this.obtenerInicialesCliente(clienteNombre),
              progressItems: 0,
              productos: productos.sort((a: any, b: any) =>
                String(a?.producto ?? '').localeCompare(String(b?.producto ?? ''), 'es', {
                  sensitivity: 'base',
                  numeric: true,
                }),
              ),
            };
          })
          .filter(Boolean);

        const maxItems = Math.max(1, ...clientes.map((cliente: any) => Number(cliente?.cantidadTotal ?? 0) || 0));
        const clientesConProgreso = clientes.map((cliente: any) => ({
          ...cliente,
          progressItems: Math.max(8, Math.round(((Number(cliente.cantidadTotal) || 0) / maxItems) * 100)),
        }));

        return {
          key: codigoMostrar || nombreVendedor,
          codVendedor: codigoMostrar,
          vendedor: nombreVendedor,
          iniciales: this.obtenerInicialesCliente(nombreVendedor),
          cantidadClientes: clientesConProgreso.length,
          ventaAcum: clientesConProgreso.reduce(
            (sum: number, cliente: any) => sum + (Number(cliente?.ventaAcum ?? 0) || 0),
            0,
          ),
          expandido: false,
          clientes: clientesConProgreso.sort((a: any, b: any) =>
            String(a?.cliente ?? '').localeCompare(String(b?.cliente ?? ''), 'es', {
              sensitivity: 'base',
              numeric: true,
            }),
          ),
        };
      })
      .filter((vendedor: any) => vendedor.cantidadClientes > 0)
      .sort((a: any, b: any) =>
        String(a?.vendedor ?? '').localeCompare(String(b?.vendedor ?? ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      );
  }

  private pintarDetalleClientesAdminDesdeEndpointConItems(res: any, filtrosConsulta: DashboardFilters): void {
    const detallePorVendedor = this.mapearVendedoresConItemsComprados(res, filtrosConsulta);

    console.debug('✅ [pintarDetalleClientesAdminDesdeEndpointConItems] Mapeo completo:', {
      vendedoresCount: detallePorVendedor.length,
      vendedorConClientesYProductos: detallePorVendedor[0],
    });

    if (!detallePorVendedor.length) {
      this.limpiarDetalleClientesAdmin();
      return;
    }

    const topVendedores = [...detallePorVendedor]
      .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 15);

    this.totalTopClientes = topVendedores.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    this.clientesAgrupados = detallePorVendedor;
    this.clientesVisibles = this.clientesPageSize;
    this.actualizarClientesVista();
    this.tableData = detallePorVendedor;
    this.chartData = topVendedores.map((vendedor: any) => ({
      name: vendedor.vendedor || vendedor.codVendedor || 'Vendedor',
      value: Number(vendedor?.ventaAcum ?? 0) || 0,
    }));

    this.chartId = 'chart-clientes-admin-' + Date.now();
    this.cargandoClientes = false;
    this.cdr.markForCheck();
  }

  private cargarDetalleClientesAdministrador(filtrosConsulta: DashboardFilters): void {
    this.cargandoClientes = true;
    this.errorClientesMsg = '';
    this.clientesAgrupados = [];
    this.clientesVista = [];
    this.totalClientesFiltrados = 0;
    this.tableData = [];
    this.chartData = [];
    this.cdr.markForCheck();

    this.cumplimientoService
      .getVendedoresConItemsComprados(filtrosConsulta)
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe({
        next: (res: any) => {
          // Verificar si hay error en la respuesta
          if (res?.data?._error) {
            const errorMsg = res.data._errorMessage || 'Error al cargar los datos';
            console.error('❌ Error cargando detalle de clientes:', errorMsg);
            this.errorClientesMsg = errorMsg;
            this.limpiarDetalleClientesAdmin();
            // Mostrar error en la UI
            this.tableData = [];
            this.chartData = [];
            this.cargandoClientes = false;
            this.cdr.markForCheck();
            return;
          }

          this.pintarDetalleClientesAdminDesdeEndpointConItems(res, filtrosConsulta);
        },
        error: (error) => {
          console.error('Error cargando /vendedor/con-items-comprados:', error);
          this.errorClientesMsg = 'Error al cargar los datos. Intenta más tarde.';
          this.limpiarDetalleClientesAdmin();
          this.cargandoClientes = false;
          this.cdr.markForCheck();
        },
      });
  }

  private esAgrupacionPorVendedor(): boolean {
    return this.activeVentasView === 'cliente' && this.rolId !== 3;
  }

  get agrupaClientesPorVendedor(): boolean {
    return this.esAgrupacionPorVendedor();
  }

  private normalizarBusquedaCliente(valor: unknown): string {
    return String(valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private actualizarClientesVista(): void {
    const term = this.normalizarBusquedaCliente(this.clienteBusqueda);
    const filtrados = this.esAgrupacionPorVendedor()
      ? this.clientesAgrupados
          .map((grupo) => {
            const vendedorMatch = this.normalizarBusquedaCliente(grupo?.vendedor).includes(term);
            const clientes = Array.isArray(grupo?.clientes) ? grupo.clientes : [];
            const clientesFiltrados = term
              ? clientes.filter(
                  (cliente: any) =>
                    this.normalizarBusquedaCliente(cliente?.cliente).includes(term) ||
                    this.normalizarBusquedaCliente(cliente?.sucursal).includes(term),
                )
              : clientes;

            if (term && !vendedorMatch && clientesFiltrados.length === 0) {
              return null;
            }

            return {
              ...grupo,
              clientes: term ? clientesFiltrados : clientes,
            };
          })
          .filter(Boolean)
      : term
        ? this.clientesAgrupados.filter((c) =>
            this.normalizarBusquedaCliente(c?.cliente).includes(term),
          )
        : this.clientesAgrupados;

    this.totalClientesFiltrados = filtrados.length;
    this.clientesVista = filtrados.slice(0, this.clientesVisibles);
  }

  get etiquetaClientesVista(): string {
    return this.esAgrupacionPorVendedor() ? 'vendedores' : 'clientes';
  }

  get placeholderBusquedaClientes(): string {
    return this.esAgrupacionPorVendedor()
      ? 'Buscar vendedor o cliente'
      : 'Buscar cliente por nombre';
  }

  get tituloListaClientes(): string {
    return this.esAgrupacionPorVendedor() ? 'Vendedores con detalle por cliente' : 'Clientes';
  }

  get tituloTopClientes(): string {
    return this.esAgrupacionPorVendedor() ? 'Top 15 Vendedores' : 'Top 15 Clientes';
  }

  onBuscarClienteChange(valor: string): void {
    this.clienteBusqueda = valor;
    this.clientesVisibles = this.clientesPageSize;
    this.actualizarClientesVista();
    this.cdr.markForCheck();
  }

  get hayMasClientes(): boolean {
    return this.totalClientesFiltrados > this.clientesVista.length;
  }

  verMasClientes(): void {
    this.clientesVisibles += this.clientesPageSize;
    this.actualizarClientesVista();
    this.cdr.markForCheck();
  }

  private getLimiteProductosCliente(key: string): number {
    return this.productosVisiblesPorCliente[key] ?? this.productosPageSize;
  }

  getProductosClienteVisibles(cliente: any): any[] {
    return (cliente?.productos ?? []).slice(0, this.getLimiteProductosCliente(cliente?.key));
  }

  getCantidadItemsCliente(cliente: any): number {
    const cantidadItems = Number(cliente?.cantidadItems);
    if (Number.isFinite(cantidadItems) && cantidadItems >= 0) return cantidadItems;

    const cantidadTotal = Number(cliente?.cantidadTotal);
    if (Number.isFinite(cantidadTotal) && cantidadTotal >= 0) return cantidadTotal;

    const productos = Array.isArray(cliente?.productos) ? cliente.productos.length : 0;
    return Number.isFinite(productos) ? productos : 0;
  }

  getCantidadItemsClienteLabel(cliente: any): string {
    return this.getCantidadItemsCliente(cliente).toLocaleString('es-CO');
  }

  getTotalClienteLabel(cliente: any): string {
    const total = Number(cliente?.totalCompras ?? cliente?.ventaAcum ?? 0);
    return Number.isFinite(total) ? total.toLocaleString('es-CO') : '0';
  }

  get totalCuotaCategoriaLabel(): string {
    return this.formatearMoneda(this.totalCuotaCategoria);
  }

  get totalAcumuladoCategoriaLabel(): string {
    return this.formatearMoneda(this.totalAcumuladoCategoria);
  }

  get totalTopCategoriasLabel(): string {
    return this.formatearMoneda(this.totalTopCategorias);
  }

  get totalTopProveedoresLabel(): string {
    return this.formatearMoneda(this.totalTopProveedores);
  }

  get totalTopVendedoresLabel(): string {
    return this.formatearMoneda(this.totalTopVendedores);
  }

  get totalCuotaProveedorLabel(): string {
    return this.formatearMoneda(this.totalCuotaProveedor);
  }

  get totalAcumuladoProveedorLabel(): string {
    return this.formatearMoneda(this.totalAcumuladoProveedor);
  }

  get totalTopClientesLabel(): string {
    return this.formatearMoneda(this.totalTopClientes);
  }

  get totalTopClientesTitulo(): string {
    return this.tituloTopClientes;
  }

  get totalTopItemsSubtotalLabel(): string {
    return this.formatearMoneda(this.totalTopItemsSubtotal);
  }

  get totalTopCiudadesLabel(): string {
    return this.formatearMoneda(this.totalTopCiudades);
  }

  get totalTopProveedoresCompactoLabel(): string {
    return this.formatearMonedaCompacta(this.totalTopProveedores);
  }

  tieneMasProductos(cliente: any): boolean {
    const total = cliente?.productos?.length ?? 0;
    return total > this.getLimiteProductosCliente(cliente?.key);
  }

  verMasProductos(cliente: any): void {
    const key = String(cliente?.key ?? '');
    if (!key) return;
    this.productosVisiblesPorCliente[key] =
      this.getLimiteProductosCliente(key) + this.productosPageSize;
    this.cdr.markForCheck();
  }

  toggleCliente(cliente: any): void {
    const esClienteAnidado = this.esAgrupacionPorVendedor() && Array.isArray(cliente?.productos);

    if (!esClienteAnidado) {
      for (const c of this.clientesVista) {
        if (c !== cliente) c.expandido = false;
      }
    }

    cliente.expandido = !cliente.expandido;

    if (cliente.expandido && cliente?.key && !this.productosVisiblesPorCliente[cliente.key]) {
      this.productosVisiblesPorCliente[cliente.key] = this.productosPageSize;
    }

    this.cdr.markForCheck();
  }

  private repararTextoCiudad(valor: unknown): string {
    const txt = String(valor ?? '').trim();
    if (!txt) return '';

    return txt.replace(/◊/g, 'ñ').replace(/Ø/g, 'Ñ').replace(/\s+/g, ' ').trim();
  }

  private normalizarTexto(valor: unknown): string {
    return this.repararTextoCiudad(valor)
      .toLowerCase()
      .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9\s.,-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private esCiudadResumen(valor: unknown): boolean {
    const ciudad = this.normalizarTexto(valor);
    return ciudad === 'total' || ciudad === 'totales' || ciudad === 'todas' || ciudad === 'todos';
  }

  private filtrarPorCiudadSeleccionada(listado: any[]): any[] {
    const ciudadFiltroRaw = String(this._filtros.ciudadNombre ?? this._filtros.ciudad ?? '').trim();
    const ciudadFiltro = this.normalizarTexto(ciudadFiltroRaw);

    const ciudadesValidas = listado.filter((item: any) => !this.esCiudadResumen(item?.ciudad));

    if (!ciudadFiltro || this.esCiudadResumen(ciudadFiltroRaw)) return ciudadesValidas;

    return ciudadesValidas.filter((item: any) => {
      const ciudadItem = this.normalizarTexto(item?.ciudad ?? '');
      return ciudadItem === ciudadFiltro;
    });
  }

  private limpiarNombreCategoria(valor: unknown): string {
    let nombre = this.repararTextoCiudad(valor);
    if (!nombre) return '';

    nombre = nombre.replace(/^\d+\s*-\s*/u, '');
    return nombre.trim();
  }

  private normalizarCategoria(valor: unknown): string {
    return this.normalizarTexto(this.limpiarNombreCategoria(valor));
  }

  private cargarMapaCategorias(): void {
    this.cumplimientoService
      .getCuotaCategoriasPorVendedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: any) => {
        const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
        const mapa = new Map<string, string>();

        for (const item of detalle) {
          const id = String(item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '').trim();
          const nombre = this.repararTextoCiudad(
            item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
          ).trim();

          if (id && nombre) {
            mapa.set(id, nombre);
          }
        }

        if (mapa.size === 0) return;

        this.categoriasPorId = mapa;

        if (this.iniciado && this.esModoAdminTodos() && this.activeVentasView === 'categoria') {
          this.solicitarCargaVista(true);
        }
      });
  }

  private obtenerNombreCategoria(item: any): string {
    const nombreDirecto = this.limpiarNombreCategoria(
      item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
    );
    if (nombreDirecto && !/^\d+$/u.test(nombreDirecto)) return nombreDirecto;

    const idCategoria = String(
      item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? nombreDirecto ?? '',
    ).trim();

    if (!idCategoria) return '';

    return this.categoriasPorId.get(idCategoria) ?? `Categoría ${idCategoria}`;
  }

  private ordenarCategoriasPorAlfabeto(listado: any[]): any[] {
    return [...listado].sort((a, b) => {
      const nombreA = this.normalizarCategoria(this.obtenerNombreCategoria(a));
      const nombreB = this.normalizarCategoria(this.obtenerNombreCategoria(b));

      const cmp = nombreA.localeCompare(nombreB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return cmp;

      return String(a?.categoria ?? '').localeCompare(String(b?.categoria ?? ''), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });
  }

  private filtrarCategorias(listado: any[], categoriaFiltroRaw: unknown): any[] {
    const categoriaFiltro = this.normalizarCategoria(categoriaFiltroRaw);
    if (!categoriaFiltro) return listado;

    return listado.filter((item: any) => {
      const categoriaItem = this.normalizarCategoria(this.obtenerNombreCategoria(item));

      return categoriaItem === categoriaFiltro || categoriaItem.includes(categoriaFiltro);
    });
  }

  private completarCategoriasSinDatos(listado: any[], categoriaFiltroRaw: unknown): any[] {
    const categoriaFiltro = this.normalizarCategoria(categoriaFiltroRaw);
    if (categoriaFiltro || this.categoriasPorId.size === 0) return listado;

    const existentes = new Set<string>();

    for (const item of listado) {
      const nombre = this.normalizarCategoria(this.obtenerNombreCategoria(item));
      const id = String(item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '').trim();

      if (nombre) existentes.add(nombre);
      if (id) existentes.add(this.normalizarCategoria(id));
    }

    const faltantes = Array.from(this.categoriasPorId.entries())
      .filter(([id, nombre]) => {
        const idNorm = this.normalizarCategoria(id);
        const nombreNorm = this.normalizarCategoria(nombre);

        return !existentes.has(idNorm) && !existentes.has(nombreNorm);
      })
      .map(([id, nombre]) => ({
        id_categoria: id,
        categoria: nombre,
        cuota: 0,
        acumulado: 0,
        ventaAcum: 0,
        proyeccionVenta: 0,
        porcCump: 0,
        porcCumProy: 0,
      }));

    return [...listado, ...faltantes];
  }

  private formatearMoneda(valor: unknown): string {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : 0;
    return `$ ${seguro.toLocaleString('es-CO')}`;
  }

  private formatearMonedaCompacta(valor: unknown): string {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : 0;
    if (Math.abs(seguro) >= 1_000_000) {
      return `$${(seguro / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(seguro) >= 1_000) {
      return `$${(seguro / 1_000).toFixed(0)}K`;
    }
    return `$${seguro.toLocaleString('es-CO')}`;
  }

  private nombreProveedorCard(lineaRaw: unknown): string {
    const linea = String(lineaRaw ?? '').trim();
    if (!linea) return '—';
    const sinCodigo = linea.replace(/^\d+\s*-\s*/u, '').trim();
    return sinCodigo || linea;
  }

  private normalizarCodigoVendedor(valor: unknown): string {
    const codigo = String(valor ?? '').trim();
    if (!codigo) return '';
    return /^\d+$/.test(codigo) && codigo.length < 4 ? codigo.padStart(4, '0') : codigo;
  }

  private obtenerIdVendedorSesion(): string {
    const usuario = this.authService.getVendedor();
    const idRaw =
      usuario?.idVendedor ??
      usuario?.id_vendedor ??
      usuario?.idVendedorAsociado ??
      usuario?.vendedor?.idVendedor ??
      usuario?.vendedor?.id_vendedor ??
      usuario?.vendedor?.id ??
      usuario?.id ??
      '';
    return String(idRaw ?? '').trim();
  }

  private mapearCuotaPorLinea(listado: any[]): any[] {
    return listado.map((item: any) => ({
      ...item,
      cuotaLinea: Number(item?.cuotaProveedor ?? item?.cuotaLinea ?? 0),
    }));
  }

  private filtrarProveedores(listado: any[], codigoProveedor: string): any[] {
    const filtroRaw = String(codigoProveedor ?? '').trim();
    if (!filtroRaw) return listado;

    const filtros = filtroRaw
      .split(',')
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .map((v) => ({
        raw: v,
        rawNorm: this.normalizarTexto(v),
        code: (v.match(/^\d+/)?.[0] ?? v).trim(),
      }));

    if (!filtros.length) return listado;

    return listado.filter((item: any) => {
      const idProveedor = String(item?.idProveedor ?? '').trim();
      const codigoLinea = String(item?.codigoLinea ?? '').trim();
      const linea = String(item?.linea ?? '').trim();
      const reporte = String(item?.reporteProvConObs ?? '').trim();

      const codigoLineaCode = (codigoLinea.match(/^\d+/)?.[0] ?? '').trim();
      const lineaCode = (linea.match(/^\d+/)?.[0] ?? '').trim();

      const hayCoincidencia = filtros.some((f) => {
        const fCode = f.code;

        if (idProveedor && f.raw === idProveedor) return true;
        if (codigoLinea && f.raw === codigoLinea) return true;
        if (linea && f.raw === linea) return true;

        if (fCode && codigoLineaCode && fCode === codigoLineaCode) return true;
        if (fCode && lineaCode && fCode === lineaCode) return true;

        const lineaNorm = this.normalizarTexto(linea);
        const codigoLineaNorm = this.normalizarTexto(codigoLinea);
        const reporteNorm = this.normalizarTexto(reporte);

        if (f.rawNorm && (lineaNorm.includes(f.rawNorm) || codigoLineaNorm.includes(f.rawNorm))) {
          return true;
        }

        if (f.rawNorm && reporteNorm.includes(f.rawNorm)) return true;

        return false;
      });

      return hayCoincidencia;
    });
  }

  private filtrarVendedores(listado: any[], codigoVendedor: string): any[] {
    const codigoRaw = String(codigoVendedor ?? '').trim();
    if (!codigoRaw) return listado;

    const match = codigoRaw.match(/^\s*(\d+)/);
    const codigo = match?.[1] ? match[1].padStart(4, '0') : codigoRaw;
    const codigoSinCeros = codigo.replace(/^0+/, '') || codigo;

    return listado.filter((item: any) => {
      const valoresFila = [
        item?.codVendedor,
        item?.codigo_vendedor,
        item?.codigoVendedor,
        item?.id_vendedor,
        item?.idVendedor,
        item?.idVendedorAsociado,
      ]
        .map((valor) => String(valor ?? '').trim())
        .filter(Boolean);

      return valoresFila.some((valorFila) => {
        const numerico = valorFila.replace(/\D/g, '');
        const valorNormalizado = numerico ? numerico.padStart(4, '0') : valorFila;
        const valorSinCeros = numerico ? String(Number(numerico)) : valorFila;

        return (
          valorFila === codigo ||
          valorNormalizado === codigo ||
          valorSinCeros === codigoSinCeros ||
          valorFila === codigoSinCeros
        );
      });
    });
  }

  private quitarProveedorDeFiltros(filtros: DashboardFilters): DashboardFilters {
    return {
      ...filtros,
      proveedor: '',
    };
  }

  private nombreProveedorOrden(item: any): string {
    const linea = String(item?.linea ?? '').trim();
    if (!linea) return '';

    const partes = linea.split('-');
    const nombre = partes.length > 1 ? partes.slice(1).join('-') : linea;

    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  private ordenarProveedoresPorAlfabeto(listado: any[]): any[] {
    return [...listado].sort((a, b) => {
      const nombreA = this.nombreProveedorOrden(a);
      const nombreB = this.nombreProveedorOrden(b);

      const cmp = nombreA.localeCompare(nombreB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });

      if (cmp !== 0) return cmp;

      const lineaA = String(a?.linea ?? '').trim();
      const lineaB = String(b?.linea ?? '').trim();
      return lineaA.localeCompare(lineaB, 'es', { sensitivity: 'base', numeric: true });
    });
  }

  private limitarTopProveedores(listado: any[]): any[] {
    return [...listado]
      .sort((a, b) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 12);
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private obtenerRangoMesActual(): { inicioMes: string; finMes: string } {
    const hoy = new Date();
    return {
      inicioMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      finMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
  }

  private obtenerRangoMesAnterior(): { inicioMes: string; finMes: string } {
    const hoy = new Date();
    return {
      inicioMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      finMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    };
  }

  private esRangoMesActual(fechaInicio: string, fechaFin: string): boolean {
    const { inicioMes, finMes } = this.obtenerRangoMesActual();
    return fechaInicio === inicioMes && fechaFin === finMes;
  }

  private aplicarFechasPorDefecto(filtros: DashboardFilters): DashboardFilters {
    const { inicioMes, finMes } = this.obtenerRangoMesActual();

    return {
      ...filtros,
      fechaInicio: String(filtros?.fechaInicio ?? '').trim() || inicioMes,
      fechaFin: String(filtros?.fechaFin ?? '').trim() || finMes,
    };
  }

  private vistaUsaUltimoMesPorDefecto(view: string): boolean {
    return false;
  }

  private aplicarUltimoMesCargadoPorDefecto(filtros: DashboardFilters): DashboardFilters {
    const fechaInicio = String(filtros?.fechaInicio ?? '').trim();
    const fechaFin = String(filtros?.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin || this.esRangoMesActual(fechaInicio, fechaFin)) {
      const { inicioMes, finMes } = this.obtenerRangoMesAnterior();
      return {
        ...filtros,
        fechaInicio: inicioMes,
        fechaFin: finMes,
      };
    }

    return {
      ...filtros,
      fechaInicio,
      fechaFin,
    };
  }

  private obtenerFiltrosMesAnteriorDesde(
    filtros: DashboardFilters,
    mesesAtras: number,
  ): DashboardFilters {
    const hoy = new Date();
    const inicioMes = this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, 1));
    const finMes = this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 0));

    return {
      ...filtros,
      fechaInicio: inicioMes,
      fechaFin: finMes,
    };
  }

  private debeAplicarFallbackAutomatico(filtros: DashboardFilters): boolean {
    const fechaInicio = String(filtros?.fechaInicio ?? '').trim();
    const fechaFin = String(filtros?.fechaFin ?? '').trim();
    return this.esRangoMesActual(fechaInicio, fechaFin);
  }

  private construirCandidatosFallback(
    filtros: DashboardFilters,
    maxMesesAtras = 6,
  ): DashboardFilters[] {
    const candidatos: DashboardFilters[] = [filtros];
    for (let i = 1; i <= maxMesesAtras; i += 1) {
      candidatos.push(this.obtenerFiltrosMesAnteriorDesde(filtros, i));
    }
    return candidatos;
  }

  cargarVistaActual(force = false): void {
    if (!this._codigoVendedor && !this.esModoAdminTodos()) return;

    const cargaKey = this.construirCargaKey();
    if (!force && cargaKey === this.ultimaCargaKey) {
      this.debugLog('VentasComponent.cargarVistaActual', 'Carga omitida por parametros repetidos');
      return;
    }
    this.ultimaCargaKey = cargaKey;
    this.debugLog('VentasComponent.cargarVistaActual', `Cargando vista ${this.activeVentasView}`);

    // Cancela peticiones previas para que solo pinte la carga mas reciente.
    this.recargarVista$.next();

    this.resetearVista();

    const filtrosBase = this.aplicarFechasPorDefecto(this._filtros);
    const filtrosConsulta = this.vistaUsaUltimoMesPorDefecto(this.activeVentasView)
      ? this.aplicarUltimoMesCargadoPorDefecto(filtrosBase)
      : filtrosBase;

    if (this.esModoAdminTodos()) {
      this.cargarVistaAdminTodos(filtrosConsulta);
      return;
    }

    const tieneProveedor = !!filtrosConsulta.proveedor;
    const codigoProveedor = filtrosConsulta.proveedor;
    const tieneCiudad = !!(filtrosConsulta.ciudad || filtrosConsulta.ciudadNombre);
    const codigoCiudad = String(filtrosConsulta.ciudad ?? '').trim();

    switch (this.activeVentasView) {
      case 'vendedor': {
        this.chartType = 'bar';

        const cargarDesdeAdmin = this.rolId === 1 || this.rolId === 2 || this.tieneCodigosVendedoresPermitidos();

        if (cargarDesdeAdmin) {
          const admin$ = this.esSemanal
            ? this.semanaService.getCumplimientoSemanaAdmin(filtrosConsulta)
            : this.cumplimientoService.getCumplimientoMesAdmin(filtrosConsulta);

          admin$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const detalle = this.filtrarPorCodigosVendedoresPermitidos(
                this.mapearDetalleAdminAVendedores(res?.detalle ?? []),
              );

              this.pintarVistaVendedor(detalle, filtrosConsulta, 'chart-vendedor');
            });
          break;
        }

        const vendedor$ = this.esSemanal
          ? this.semanaService.getCumplimientoSemanaVendedor(filtrosConsulta)
          : this.cumplimientoService.getCumplimientoPorCodigo(this._codigoVendedor, filtrosConsulta);

        vendedor$
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const detalle = this.mapearDetalleAdminAVendedores(res?.detalle ?? []);
            this.pintarVistaVendedor(detalle, filtrosConsulta, 'chart-vendedor');
          });
        break;
      }

      case 'ventas':
        this.chartType = 'line';

        if (tieneProveedor) {
          const detalleProveedor$ = this.esSemanal
            ? this.semanaService.getDetallePorLineaProveedor(
                this._codigoVendedor,
                codigoProveedor,
                filtrosConsulta,
              )
            : this.cumplimientoService.getDetallePorLineaProveedor(
                this._codigoVendedor,
                codigoProveedor,
                filtrosConsulta,
              );

          detalleProveedor$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const detalle = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              const listadoTabla = this.ordenarProveedoresPorAlfabeto(detalle);
              const topProveedores = this.limitarTopProveedores(detalle);
              this.tableData = listadoTabla;
              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea,
                value: i.ventaAcum,
              }));
              this.cdr.markForCheck();
            });
        } else if (tieneCiudad) {
          const ciudades$ = this.esSemanal
            ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, filtrosConsulta)
            : codigoCiudad
              ? this.cumplimientoService.getDetallePorCiudad(
                  this._codigoVendedor,
                  codigoCiudad,
                  filtrosConsulta,
                )
              : this.cumplimientoService.getCiudadesPorVendedor(
                  this._codigoVendedor,
                  filtrosConsulta,
                );

          ciudades$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const listado = this.filtrarPorCiudadSeleccionada(res?.detallePorCiudad ?? []);
              this.tableData = listado;
              this.chartData = listado.map((i: any) => ({
                name: this.repararTextoCiudad(i.ciudad),
                value: i.ventaAcum,
              }));
              this.cdr.markForCheck();
            });
        } else if (this.esSemanal) {
          this.semanaService
            .getCumplimientoSemanaVendedor(filtrosConsulta)
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const d = (res?.detalle ?? []).find((v: any) => v.codVendedor !== 'TOTALES');
              if (!d) return;

              this.tableData = [d];
              this.chartData = [
                { name: 'Venta', value: d.ventaAcum },
                { name: 'Cuota', value: d.cuotaSemana },
                { name: 'Proyección', value: d.proyeccionVenta },
              ];
              this.cdr.markForCheck();
            });
        } else {
          this.cumplimientoService
            .getCumplimientoPorCodigo(this._codigoVendedor, filtrosConsulta)
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              if (!res?.totales) return;

              this.tableData = res.detalle ?? [];
              this.chartData = [
                { name: 'Venta', value: res.totales.ventaAcum },
                { name: 'Cuota', value: res.totales.cuotaMes },
                { name: 'Proyección', value: res.totales.proyeccionVenta },
              ];
              this.cdr.markForCheck();
            });
        }
        break;

      case 'proveedor':
        this.chartType = 'bar';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarProveedor = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const filtrosSinProveedor = this.quitarProveedorDeFiltros(filtrosActivos);
            const lineas$ = this.esSemanal
              ? this.semanaService.getLineasPorVendedor(this._codigoVendedor, filtrosSinProveedor)
              : this.cumplimientoService.getLineasPorVendedor(
                  this._codigoVendedor,
                  filtrosSinProveedor,
                );

            lineas$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listado = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
                const listadoFiltrado = this.filtrarProveedores(listado, codigoProveedor);

                if (!listadoFiltrado.length && idx < candidatos.length - 1) {
                  intentarProveedor(idx + 1);
                  return;
                }

                const listadoTabla = this.ordenarProveedoresPorAlfabeto(listado);
                const topProveedores = [...listadoFiltrado]
                  .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                  .slice(0, 12);

                this.totalTopProveedores = topProveedores.reduce(
                  (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.liderVentasProveedor = this.nombreProveedorCard(
                  topProveedores[0]?.linea ?? '—',
                );

                this.tableData = codigoProveedor
                  ? this.ordenarProveedoresPorAlfabeto(listadoFiltrado)
                  : listadoTabla;
                this.totalCuotaProveedor = this.tableData.reduce(
                  (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                  0,
                );
                this.totalAcumuladoProveedor = this.tableData.reduce(
                  (sum: number, item: any) =>
                    sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.totalCuotaProveedor = this.tableData.reduce(
                  (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                  0,
                );
                this.totalAcumuladoProveedor = this.tableData.reduce(
                  (sum: number, item: any) =>
                    sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.chartData = topProveedores.map((i: any) => ({
                  name: i.linea,
                  value: Number(i.ventaAcum ?? 0),
                }));
                this.cdr.markForCheck();
              });
          };

          intentarProveedor(0);
        }
        break;

      case 'categoria':
        this.chartType = 'bar';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCategoria = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const categorias$ = this.esSemanal
              ? this.semanaService.getCuotaCategoriaPorVendedor(
                  this._codigoVendedor,
                  filtrosActivos,
                )
              : this.cumplimientoService.getCuotaCategoriaPorVendedor(
                  this._codigoVendedor,
                  filtrosActivos,
                );

            categorias$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
                const detalleFiltrado = this.filtrarCategorias(detalle, filtrosActivos.categoria);
                const detalleConNombre = detalleFiltrado.map((item: any) => ({
                  ...item,
                  categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
                }));
                const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleConNombre);

                if (!detalleFiltrado.length && idx < candidatos.length - 1) {
                  intentarCategoria(idx + 1);
                  return;
                }

                this.tableData = detalleOrdenado;

                this.totalCuotaCategoria = detalleOrdenado.reduce(
                  (sum: number, item: any) => sum + (Number(item?.cuota ?? 0) || 0),
                  0,
                );

                this.totalAcumuladoCategoria = detalleOrdenado.reduce(
                  (sum: number, item: any) =>
                    sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                  0,
                );

                const topCategorias = [...detalleConNombre]
                  .map((i: any) => ({
                    name: this.obtenerNombreCategoria(i) || 'Sin categoría',
                    value: Number(i?.acumulado ?? i?.ventaAcum ?? 0),
                  }))
                  .sort((a: any, b: any) => b.value - a.value)
                  .slice(0, 15);

                this.totalTopCategorias = topCategorias.reduce(
                  (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
                  0,
                );

                this.chartData = topCategorias;
                this.chartId = 'chart-categoria-' + Date.now();
                this.cdr.markForCheck();
              });
          };

          intentarCategoria(0);
        }
        break;

      case 'ciudad':
        this.chartType = 'pie';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCiudad = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const codigoCiudadActivo = String(filtrosActivos.ciudad ?? '').trim();
            const ciudades$ = this.esSemanal
              ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, filtrosActivos)
              : codigoCiudadActivo
                ? this.cumplimientoService.getDetallePorCiudad(
                    this._codigoVendedor,
                    codigoCiudadActivo,
                    filtrosActivos,
                  )
                : this.cumplimientoService.getCiudadesPorVendedor(
                    this._codigoVendedor,
                    filtrosActivos,
                  );

            ciudades$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listadoCompleto = res?.detallePorCiudad ?? [];
                const listadoFiltrado = this.filtrarPorCiudadSeleccionada(listadoCompleto);

                if (!listadoFiltrado.length && idx < candidatos.length - 1) {
                  intentarCiudad(idx + 1);
                  return;
                }

                const listadoMapeado = listadoFiltrado.map((i: any) => ({
                  ...i,
                  ciudad: this.repararTextoCiudad(i.ciudad),
                }));
                const ordenadoCiudades = [...listadoMapeado].sort((a: any, b: any) =>
                  this.repararTextoCiudad(a?.ciudad).localeCompare(
                    this.repararTextoCiudad(b?.ciudad),
                    'es',
                  ),
                );
                const topCiudades = [...listadoMapeado]
                  .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                  .slice(0, 15);
                this.tableData = ordenadoCiudades;
                this.totalTopCiudades = topCiudades.reduce(
                  (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.chartData = topCiudades.map((i: any) => ({
                  name: this.repararTextoCiudad(i.ciudad),
                  value: i.ventaAcum,
                }));
                this.cdr.markForCheck();
              });
          };

          intentarCiudad(0);
        }
        break;

      case 'item':
        this.chartType = 'bar';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarItem = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const items$ = this.esSemanal
              ? this.semanaService.getProductosPorVendedor(this._codigoVendedor, filtrosActivos)
              : this.cumplimientoService.getProductosPorVendedor(
                  this._codigoVendedor,
                  filtrosActivos,
                );

            items$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listado = res?.data ?? [];

                if (!listado.length && idx < candidatos.length - 1) {
                  intentarItem(idx + 1);
                  return;
                }

                const listadoOrdenado = this.ordenarDetalleItemsPorFechaAsc(listado);
                this.allItemData = listadoOrdenado;
                this.tableData = [...listadoOrdenado];
                this.recalcularChart();
              });
          };

          intentarItem(0);
        }
        break;

      case 'cliente':
        this.chartType = 'bar';

        const idVendedor = this.obtenerIdVendedorSesion();
        if (!idVendedor) {
          this.clientesAgrupados = [];
          this.clientesVista = [];
          this.totalClientesFiltrados = 0;
          this.tableData = [];
          this.chartData = [];
          this.cdr.markForCheck();
          return;
        }

        this.cargandoClientes = true;

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCliente = (idx: number): void => {
            const filtrosActivos = candidatos[idx];

            this.cumplimientoService
              .getProductosPorCliente(idVendedor, filtrosActivos)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe({
                next: (res: any) => {
                  const listado = Array.isArray(res?.data) ? res.data : [];

                  if (!listado.length && idx < candidatos.length - 1) {
                    intentarCliente(idx + 1);
                    return;
                  }

                  const detalleClientes = this.construirDetalleClientes(listado);
                  const topClientes = [...detalleClientes]
                    .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                    .slice(0, 15);

                  this.totalTopClientes = topClientes.reduce(
                    (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                    0,
                  );

                  this.clientesAgrupados = detalleClientes;
                  this.clientesVisibles = this.clientesPageSize;
                  this.actualizarClientesVista();
                  this.tableData = detalleClientes;
                  this.chartData = topClientes.map((i: any) => ({
                    name: i.cliente,
                    value: i.ventaAcum,
                  }));
                  this.cargandoClientes = false;
                  this.cdr.markForCheck();
                },
                error: () => {
                  if (idx < candidatos.length - 1) {
                    intentarCliente(idx + 1);
                    return;
                  }

                  this.cargandoClientes = false;
                  this.clientesAgrupados = [];
                  this.clientesVista = [];
                  this.totalClientesFiltrados = 0;
                  this.tableData = [];
                  this.chartData = [];
                  this.cdr.markForCheck();
                },
              });
          };

          intentarCliente(0);
        }
        break;
    }
  }

  // For dashboard parent to force a reload when filters/tipoCuota change
  public reloadView(force = true): void {
    this.solicitarCargaVista(!!force);
  }
}
