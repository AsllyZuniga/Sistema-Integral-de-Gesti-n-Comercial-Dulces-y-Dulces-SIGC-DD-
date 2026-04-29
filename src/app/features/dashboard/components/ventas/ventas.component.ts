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
import { forkJoin, merge, of, Subject, takeUntil } from 'rxjs';
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

  @Input() set codigoVendedor(value: string) {
    this._codigoVendedor = this.normalizarCodigoVendedor(value);
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
    if (this.iniciado) {
      this.solicitarCargaVista(true);
    }
  }
  get modoAdmin(): boolean {
    return this._modoAdmin;
  }
  private _modoAdmin = false;

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
  totalCuotaCategoria = 0;
  totalAcumuladoCategoria = 0;
  totalTopCategorias = 0;
  totalTopProveedores = 0;
  totalTopClientes = 0;
  totalTopItemsSubtotal = 0;
  liderVentasProveedor = '—';

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
    this.activeVentasView = this.rolId === 3 ? 'proveedor' : 'ventas';
  }

  ngOnInit(): void {
    this.iniciado = true;
    if (this._codigoVendedor) {
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
    this.totalTopClientes = 0;
    this.totalTopItemsSubtotal = 0;
    this.liderVentasProveedor = '—';
    this.clientesVisibles = this.clientesPageSize;
    this.chartId = 'chart-' + this.activeVentasView + '-' + Date.now();
    this.cdr.markForCheck();
  }

  setVentasView(view: string): void {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.solicitarCargaVista(true);
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
      tipoCuota: this._tipoCuota,
      filtros: this._filtros,
    });
  }

  private solicitarCargaVista(force = false): void {
    if ((!this._codigoVendedor && !this.esModoAdminTodos()) || !this.iniciado) return;

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
      .filter((row: any) => String(row?.codVendedor ?? row?.codigo_vendedor ?? '').trim() !== 'TOTALES')
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
    const admin$ = this.esSemanal
      ? this.semanaService.getCumplimientoSemanaAdmin(filtrosConsulta)
      : this.cumplimientoService.getCumplimientoMesAdmin(filtrosConsulta);

    switch (this.activeVentasView) {
      case 'categoria':
        this.chartType = 'bar';
        this.cumplimientoService
          .getCuotaCategoriaGeneral(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const pintarCategoria = (detalleRaw: any[]) => {
              const detalleFiltrado = this.filtrarCategorias(detalleRaw, filtrosConsulta.categoria);
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
                (sum: number, item: any) => sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
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

      case 'item':
      case 'cliente':
        this.chartType = 'bar';

        if (this.activeVentasView === 'cliente') {
          this.cumplimientoService
            .getProductosPorClienteGeneral(filtrosConsulta)
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const listadoGeneral = Array.isArray(res?.data) ? res.data : [];
              if (listadoGeneral.length > 0) {
                const detalleClientes = this.construirDetalleClientes(listadoGeneral);
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
                this.chartData = topClientes.map((i: any) => ({ name: i.cliente, value: i.ventaAcum }));
                this.cargandoClientes = false;
                this.cdr.markForCheck();
                return;
              }

              this.cumplimientoService
                .getVendedores()
                .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
                .subscribe((vendedores: any[]) => {
                  const codigos = (Array.isArray(vendedores) ? vendedores : [])
                    .map((v: any) =>
                      String(v?.codigo_vendedor ?? v?.codVendedor ?? v?.codigo ?? '').trim(),
                    )
                    .filter(Boolean);

                  if (!codigos.length) {
                    this.tableData = [];
                    this.chartData = [];
                    this.cdr.markForCheck();
                    return;
                  }

                  const calls = codigos.map((codigo) =>
                    this.cumplimientoService.getProductosPorCliente(codigo, filtrosConsulta),
                  );

                  forkJoin(calls)
                    .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
                    .subscribe((responses: any[]) => {
                      const listado = responses.flatMap((r: any) => (Array.isArray(r?.data) ? r.data : []));
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
                      this.chartData = topClientes.map((i: any) => ({ name: i.cliente, value: i.ventaAcum }));
                      this.cargandoClientes = false;
                      this.cdr.markForCheck();
                    });
                });
            });

          return;
        }

        this.cumplimientoService
          .getVendedores()
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((vendedores: any[]) => {
            const codigos = (Array.isArray(vendedores) ? vendedores : [])
              .map((v: any) =>
                String(v?.codigo_vendedor ?? v?.codVendedor ?? v?.codigo ?? '').trim(),
              )
              .filter(Boolean);

            if (!codigos.length) {
              this.tableData = [];
              this.chartData = [];
              this.cdr.markForCheck();
              return;
            }

            const calls = codigos.map((codigo) =>
              this.activeVentasView === 'item'
                ? this.cumplimientoService.getProductosPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getProductosPorCliente(codigo, filtrosConsulta),
            );

            forkJoin(calls)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((responses: any[]) => {
                if (this.activeVentasView === 'item') {
                  const listado = responses.flatMap((r: any) => (Array.isArray(r?.data) ? r.data : []));
                  const listadoOrdenado = this.ordenarDetalleItemsPorFechaAsc(listado);
                  this.allItemData = listadoOrdenado;
                  this.tableData = [...listadoOrdenado];
                  this.recalcularChart();
                  return;
                }

                const listado = responses.flatMap((r: any) => (Array.isArray(r?.data) ? r.data : []));
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
                this.chartData = topClientes.map((i: any) => ({ name: i.cliente, value: i.ventaAcum }));
                this.cargandoClientes = false;
                this.cdr.markForCheck();
              });
          });
        return;

      default:
        admin$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
          const detalle = this.mapearDetalleAdminAVendedores(res?.detalle ?? []);

          switch (this.activeVentasView) {
            case 'ventas':
            case 'vendedor': {
              this.chartType = this.activeVentasView === 'ventas' ? 'line' : 'bar';
              this.tableData = detalle;
              const venta = detalle.reduce((s: number, r: any) => s + (Number(r?.ventaAcum ?? 0) || 0), 0);
              const cuota = detalle.reduce((s: number, r: any) => s + (Number(r?.[this.cuotaColumn] ?? 0) || 0), 0);
              const proyeccion = detalle.reduce(
                (s: number, r: any) => s + (Number(r?.proyeccionVenta ?? 0) || 0),
                0,
              );

              this.chartData =
                this.activeVentasView === 'ventas'
                  ? [
                      { name: 'Venta', value: venta },
                      { name: 'Cuota', value: cuota },
                      { name: 'Proyección', value: proyeccion },
                    ]
                  : detalle.map((v: any) => ({
                      name: v?.nombre || v?.codVendedor || 'Vendedor',
                      value: Number(v?.ventaAcum ?? 0),
                    }));
              break;
            }

            case 'proveedor': {
              this.chartType = 'bar';
              const agrupado = this.agruparAdminPorCampo(detalle, 'linea', 'linea');
              const ordenado = this.ordenarProveedoresPorAlfabeto(agrupado);
              const topProveedores = [...agrupado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);

              this.totalTopProveedores = topProveedores.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.liderVentasProveedor = this.nombreProveedorCard(topProveedores[0]?.linea ?? '—');
              this.tableData = ordenado;
              this.chartData = topProveedores.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
              break;
            }

            case 'ciudad': {
              this.chartType = 'pie';
              const agrupado = this.agruparAdminPorCampo(detalle, 'ciudad', 'ciudad').map((r: any) => ({
                ...r,
                ciudad: this.repararTextoCiudad(r?.ciudad),
              }));
              const filtrado = this.filtrarPorCiudadSeleccionada(agrupado);
              const topCiudades = [...filtrado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);

              this.tableData = filtrado;
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
    return this.formatearMoneda(total);
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

  get totalTopClientesLabel(): string {
    return this.formatearMoneda(this.totalTopClientes);
  }

  get totalTopItemsSubtotalLabel(): string {
    return this.formatearMoneda(this.totalTopItemsSubtotal);
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

  private limpiarNombreCategoria(valor: unknown): string {
    let nombre = this.repararTextoCiudad(valor);
    if (!nombre) return '';

    nombre = nombre.replace(/^\d+\s*-\s*/u, '');
    return nombre.trim();
  }

  private normalizarCategoria(valor: unknown): string {
    return this.normalizarTexto(this.limpiarNombreCategoria(valor));
  }

  private obtenerNombreCategoria(item: any): string {
    return this.limpiarNombreCategoria(
      item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
    );
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
      const categoriaItem = this.normalizarCategoria(
        item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
      );

      return categoriaItem === categoriaFiltro || categoriaItem.includes(categoriaFiltro);
    });
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
      case 'ventas':
        this.chartType = 'line';

        if (tieneProveedor) {
          const detalleProveedor$ = this.esSemanal
            ? this.semanaService.getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, filtrosConsulta)
            : this.cumplimientoService.getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, filtrosConsulta);

          detalleProveedor$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
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

          ciudades$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
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
              : this.cumplimientoService.getLineasPorVendedor(this._codigoVendedor, filtrosSinProveedor);

            lineas$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
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
              this.liderVentasProveedor = this.nombreProveedorCard(topProveedores[0]?.linea ?? '—');

              this.tableData = codigoProveedor
                ? this.ordenarProveedoresPorAlfabeto(listadoFiltrado)
                : listadoTabla;
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
              ? this.semanaService.getCuotaCategoriaPorVendedor(this._codigoVendedor, filtrosActivos)
              : this.cumplimientoService.getCuotaCategoriaPorVendedor(this._codigoVendedor, filtrosActivos);

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
                : this.cumplimientoService.getCiudadesPorVendedor(this._codigoVendedor, filtrosActivos);

            ciudades$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
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

        const vendedor$ = this.esSemanal
          ? this.semanaService.getCumplimientoPorCodigo(this._codigoVendedor, filtrosConsulta)
          : this.cumplimientoService.getCumplimientoPorCodigo(this._codigoVendedor, filtrosConsulta);

        vendedor$
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
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
            const items$ = this.esSemanal
              ? this.semanaService.getProductosPorVendedor(this._codigoVendedor, filtrosActivos)
              : this.cumplimientoService.getProductosPorVendedor(this._codigoVendedor, filtrosActivos);

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
                  this.chartData = topClientes.map((i: any) => ({ name: i.cliente, value: i.ventaAcum }));
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