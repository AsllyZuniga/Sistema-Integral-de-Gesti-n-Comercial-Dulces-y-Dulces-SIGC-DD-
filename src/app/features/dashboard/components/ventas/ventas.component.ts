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
import { Subject, finalize, takeUntil } from 'rxjs';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { ChartComponent } from '../../../../shared/components/chart';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { AuthService } from '../../../../core/services/auth.service';
import { TipoCuota } from '../../../cumplimientos-cuota/cumplimientos.component';

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

  @Input() set codigoVendedor(value: string) {
    this._codigoVendedor = this.normalizarCodigoVendedor(value);
    if (value && this.iniciado) {
      this.cargarVistaActual();
    }
  }
  get codigoVendedor(): string {
    return this._codigoVendedor;
  }
  private _codigoVendedor = '';

  @Input() set tipoCuota(value: TipoCuota) {
    const cambio = this._tipoCuota !== value;
    this._tipoCuota = value;

    if (cambio && this._codigoVendedor && this.iniciado) {
      this.resetearVista();
      this.cargarVistaActual();
    }
  }
  get tipoCuota(): TipoCuota {
    return this._tipoCuota;
  }
  private _tipoCuota: TipoCuota = 'mensual';

  @Input() set filtros(value: DashboardFilters) {
    this._filtros = value;
    if (this._codigoVendedor && this.iniciado) {
      this.cargarVistaActual();
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
  private iniciado = false;

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
    if (this.rolId === 3) {
      return this.todasLasVistas.filter((v) => v.key !== 'ventas' && v.key !== 'vendedor');
    }
    return this.todasLasVistas;
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
  readonly clienteProductosColumns = ['producto', 'cantidad', 'precio', 'subtotal'];

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
    this.activeVentasView = this.rolId === 3 ? 'proveedor' : 'ventas';
  }

  ngOnInit(): void {
    this.iniciado = true;
    if (this._codigoVendedor) {
      this.cargarVistaActual();
    }
  }

  ngOnDestroy(): void {
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
    this.clientesVisibles = this.clientesPageSize;
    this.chartId = 'chart-' + this.activeVentasView + '-' + Date.now();
    this.cdr.markForCheck();
  }

  setVentasView(view: string): void {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.cargarVistaActual();
  }

  private recalcularChart(): void {
    const agg = new Map<string, number>();

    for (const row of this.allItemData) {
      const key = row.Descripcion ?? 'SIN DESCRIPCION';
      agg.set(key, (agg.get(key) ?? 0) + Number(row.Venta_Unid_Cajas ?? 0));
    }

    this.chartData = Array.from(agg.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

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
    const id = row?.id_cliente ?? row?.id_cliente_sucursal ?? row?.idClienteSucursal ?? row?.idCliente ?? '';
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
    const fecha = row?.fecha ?? row?.Fecha ?? row?.fecha_venta ?? row?.fechaVenta ?? '';
    return String(fecha).trim();
  }

  private parseFechaOrden(fechaRaw: string): number {
    const fecha = String(fechaRaw ?? '').trim();
    if (!fecha) return Number.MAX_SAFE_INTEGER;

    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (iso.test(fecha)) {
      return new Date(`${fecha}T00:00:00`).getTime();
    }

    const latino = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const matchLatino = fecha.match(latino);
    if (matchLatino) {
      const [, dd, mm, yyyy] = matchLatino;
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).getTime();
    }

    const intento = new Date(fecha).getTime();
    return Number.isNaN(intento) ? Number.MAX_SAFE_INTEGER : intento;
  }

  private ordenarDetalleItemsPorFechaAsc(listado: any[]): any[] {
    return [...listado].sort((a: any, b: any) => {
      const fechaA = this.parseFechaOrden(this.obtenerFechaVenta(a));
      const fechaB = this.parseFechaOrden(this.obtenerFechaVenta(b));
      if (fechaA !== fechaB) return fechaA - fechaB;

      const proveedorA = String(a?.Proveedor ?? a?.proveedor ?? '').trim();
      const proveedorB = String(b?.Proveedor ?? b?.proveedor ?? '').trim();
      return proveedorA.localeCompare(proveedorB, 'es', { sensitivity: 'base' });
    });
  }

  private formatearFechaCorta(fechaIso: string): string {
    if (!fechaIso) return 'Sin fecha';
    const fecha = new Date(`${fechaIso}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
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
    const cantidad = row?.cantidad_total ?? row?.Cantidad ?? row?.cantidad ?? row?.Venta_Unid_Cajas ?? 0;
    const num = Number(cantidad);
    return Number.isFinite(num) ? num : 0;
  }

  private obtenerPrecioUnitarioItem(row: any): number {
    const valor = row?.precio_unitario ?? row?.precioUnitario ?? row?.Precio_Unitario ?? row?.precio ?? 0;
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

  private normalizarBusquedaCliente(valor: unknown): string {
    return String(valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private actualizarClientesVista(): void {
    const term = this.normalizarBusquedaCliente(this.clienteBusqueda);
    const filtrados = term
      ? this.clientesAgrupados.filter((c) =>
          this.normalizarBusquedaCliente(c?.cliente).includes(term),
        )
      : this.clientesAgrupados;

    this.totalClientesFiltrados = filtrados.length;
    this.clientesVista = filtrados.slice(0, this.clientesVisibles);
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
    const total = Number(cliente?.ventaAcum ?? 0);
    const valor = Number.isFinite(total) ? total : 0;
    return `$ ${valor.toLocaleString('es-CO')}`;
  }

  tieneMasProductos(cliente: any): boolean {
    const total = cliente?.productos?.length ?? 0;
    return total > this.getLimiteProductosCliente(cliente?.key);
  }

  verMasProductos(cliente: any): void {
    const key = String(cliente?.key ?? '');
    if (!key) return;
    this.productosVisiblesPorCliente[key] = this.getLimiteProductosCliente(key) + this.productosPageSize;
    this.cdr.markForCheck();
  }

  toggleCliente(cliente: any): void {
    for (const c of this.clientesVista) {
      if (c !== cliente) c.expandido = false;
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
    const codigo = String(codigoProveedor ?? '').trim();
    if (!codigo) return listado;

    return listado.filter((item: any) => {
      const idProveedor = String(item?.idProveedor ?? '').trim();
      const codigoLinea = String(item?.codigoLinea ?? '').trim();
      return idProveedor === codigo || codigoLinea === codigo;
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

  cargarVistaActual(): void {
    if (!this._codigoVendedor) return;

    this.resetearVista();

    const filtrosBase = this.aplicarFechasPorDefecto(this._filtros);
    const filtrosConsulta = this.vistaUsaUltimoMesPorDefecto(this.activeVentasView)
      ? this.aplicarUltimoMesCargadoPorDefecto(filtrosBase)
      : filtrosBase;

    const tieneProveedor = !!filtrosConsulta.proveedor;
    const codigoProveedor = filtrosConsulta.proveedor;
    const tieneCiudad = !!(filtrosConsulta.ciudad || filtrosConsulta.ciudadNombre);
    const codigoCiudad = String(filtrosConsulta.ciudad ?? '').trim();

    switch (this.activeVentasView) {
      case 'ventas':
        this.chartType = 'line';

        if (tieneProveedor) {
          this.cumplimientoService
            .getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, filtrosConsulta)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              const detalle = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              const listadoTabla = this.ordenarProveedoresPorAlfabeto(detalle);
              const topProveedores = this.limitarTopProveedores(detalle);
              this.tableData = listadoTabla;
              this.chartData = topProveedores.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
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

          ciudades$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
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
            .pipe(takeUntil(this.destroy$))
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
            .pipe(takeUntil(this.destroy$))
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
              : this.cumplimientoService.getLineasPorVendedor(this._codigoVendedor, filtrosSinProveedor);

            lineas$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
              const listado = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              const listadoFiltrado = this.filtrarProveedores(listado, codigoProveedor);

              if (!listadoFiltrado.length && idx < candidatos.length - 1) {
                intentarProveedor(idx + 1);
                return;
              }

              const listadoTabla = this.ordenarProveedoresPorAlfabeto(listado);
              const topProveedores = this.limitarTopProveedores(listadoFiltrado);
              this.tableData = codigoProveedor
                ? this.ordenarProveedoresPorAlfabeto(listadoFiltrado)
                : listadoTabla;
              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea,
                value: Number(i.cuotaLinea ?? 0),
              }));
              this.cdr.markForCheck();
            });
          };

          intentarProveedor(0);
        }
        break;

      case 'categoria':
        this.chartType = 'bar';

        this.cumplimientoService
          .getCuotaCategoriaPorVendedor(this._codigoVendedor, filtrosConsulta)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res: any) => {
            const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
            this.tableData = detalle;
            this.chartData = [...detalle]
              .sort((a: any, b: any) => Number(b?.acumulado ?? 0) - Number(a?.acumulado ?? 0))
              .slice(0, 10)
              .map((i: any) => ({
                name: i?.categoria ?? 'Sin categoría',
                value: Number(i?.acumulado ?? 0),
              }));
            this.cdr.markForCheck();
          });
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
                : this.cumplimientoService.getCiudadesPorVendedor(this._codigoVendedor, filtrosActivos);

            ciudades$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
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
              const topCiudades = [...listadoFiltrado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);
              this.tableData = listadoMapeado;
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

      case 'vendedor':
        this.chartType = 'bar';

        this.cumplimientoService
          .getCumplimientoPorCodigo(this._codigoVendedor, filtrosConsulta)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res: any) => {
            if (!res?.totales) return;

            const vendedor = res.detalle?.[0];
            this.tableData = res.detalle ?? [];
            this.chartData = [{ name: vendedor?.nombre || '', value: res.totales.ventaAcum }];
            this.cdr.markForCheck();
          });
        break;

      case 'item':
        this.chartType = 'bar';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarItem = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            this.cumplimientoService
              .getProductosPorVendedor(this._codigoVendedor, filtrosActivos)
              .pipe(takeUntil(this.destroy$))
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

        this.cumplimientoService
          .getProductosPorCliente(idVendedor, filtrosConsulta)
          .pipe(takeUntil(this.destroy$))
          .pipe(finalize(() => {
            this.cargandoClientes = false;
            this.cdr.markForCheck();
          }))
          .subscribe((res: any) => {
            const listado = res?.data ?? [];
            const detalleClientes = this.construirDetalleClientes(listado);
            const topClientes = [...detalleClientes]
              .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
              .slice(0, 10);

            this.clientesAgrupados = detalleClientes;
            this.clientesVisibles = this.clientesPageSize;
            this.actualizarClientesVista();
            this.tableData = detalleClientes;
            this.chartData = topClientes.map((i: any) => ({ name: i.cliente, value: i.ventaAcum }));

            this.cdr.markForCheck();
          });
        break;
    }
  }
}
