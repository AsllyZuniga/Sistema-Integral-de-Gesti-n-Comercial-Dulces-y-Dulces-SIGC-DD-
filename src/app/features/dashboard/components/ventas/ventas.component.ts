import { Component, Input, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent, TableComponent],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
})
export class VentasComponent implements OnInit, OnChanges, OnDestroy {
  @Input() codigoVendedor!: string;

  @Input() set filtros(value: DashboardFilters) {
    this._filtros = value;
    // ✅ Solo carga si ya tenemos codigoVendedor y el componente ya fue inicializado
    if (this.codigoVendedor && this.iniciado) {
      this.cargarVistaActual();
    }
  }
  get filtros(): DashboardFilters { return this._filtros; }

  private _filtros: DashboardFilters = {
    fechaInicio: '', fechaFin: '', vendedor: '',
    proveedor: '', categoria: '', ciudad: '',
  };

  private destroy$ = new Subject<void>();
  private iniciado = false;

  rolId              = 0;
  activeVentasView   = 'ventas';
  chartId            = 'chart-main';
  chartType: 'line' | 'bar' | 'pie' = 'line';
  tableData: any[]   = [];
  chartData: any[]   = [];
  private allItemData: any[] = [];

  private readonly todasLasVistas = [
    { key: 'ventas',    label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad',    label: 'Por Ciudad' },
    { key: 'vendedor',  label: 'Por Vendedor' },
    { key: 'item',      label: 'Detalle por Item' },
  ];

  get ventasViews() {
    if (this.rolId === 3) {
      return this.todasLasVistas.filter(v => v.key !== 'ventas' && v.key !== 'vendedor');
    }
    return this.todasLasVistas;
  }

  readonly tableColumns     = ['codVendedor', 'nombre', 'cuotaMes', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly lineasColumns    = ['linea',   'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly ciudadesColumns  = ['ciudad',  'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly productosColumns = ['Fecha', 'Proveedor', 'Cod_Item', 'Descripcion', 'Venta_Unid_Cajas', 'Cantidad', 'Subtotal'];

  constructor(
    private cumplimientoService: CumplimientoService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {
    // ✅ Leer rol desde sessionStorage via AuthService
    const usuario = this.authService.getVendedor();
    this.rolId = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);
    this.activeVentasView = this.rolId === 3 ? 'proveedor' : 'ventas';
  }

  ngOnInit(): void {
    this.iniciado = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['codigoVendedor'] && this.codigoVendedor) {
      this.cargarVistaActual();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    this.cdr.detectChanges();
  }

  cargarVistaActual(): void {
    if (!this.codigoVendedor) return;

    this.tableData   = [];
    this.chartData   = [];
    this.allItemData = [];
    this.chartId     = 'chart-' + this.activeVentasView + '-' + Date.now();

    const tieneProveedor = !!this._filtros.proveedor;
    const codigoProveedor = this._filtros.proveedor;

    switch (this.activeVentasView) {

      case 'ventas':
        this.chartType = 'line';
        if (tieneProveedor) {
          this.cumplimientoService
            .getDetallePorLineaProveedor(this.codigoVendedor, codigoProveedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res) => {
              const detalle = res?.detallePorLinea ?? [];
              this.tableData = detalle;
              this.chartData = detalle.map((item: any) => ({
                name: item.linea, value: item.ventaAcum,
              }));
              this.cdr.detectChanges();
            });
        } else {
          this.cumplimientoService
            .getCumplimientoPorCodigo(this.codigoVendedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res) => {
              if (!res || !res.totales) return;
              this.tableData = res.detalle ?? [];
              this.chartData = [
                { name: 'Venta',      value: res.totales.ventaAcum },
                { name: 'Cuota',      value: res.totales.cuotaMes },
                { name: 'Proyección', value: res.totales.proyeccionVenta },
              ];
              this.cdr.detectChanges();
            });
        }
        break;

      case 'proveedor':
        this.chartType = 'bar';
        if (tieneProveedor) {
          this.cumplimientoService
            .getDetallePorLineaProveedor(this.codigoVendedor, codigoProveedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res) => {
              const detalle = res?.detallePorLinea ?? [];
              this.tableData = detalle;
              this.chartData = detalle.map((item: any) => ({
                name: item.linea, value: item.ventaAcum,
              }));
              this.cdr.detectChanges();
            });
        } else {
          this.cumplimientoService
            .getLineasPorVendedor(this.codigoVendedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res) => {
              const listado = res?.detallePorLinea ?? [];
              this.tableData = listado;
              this.chartData = listado.map((item: any) => ({
                name: item.linea, value: item.ventaAcum,
              }));
              this.cdr.detectChanges();
            });
        }
        break;

      case 'ciudad':
        this.chartType = 'pie';
        this.cumplimientoService
          .getCiudadesPorVendedor(this.codigoVendedor, this._filtros)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res) => {
            const listado = res?.detallePorCiudad ?? [];
            this.tableData = listado;
            this.chartData = listado.map((item: any) => ({
              name: item.ciudad, value: item.ventaAcum,
            }));
            this.cdr.detectChanges();
          });
        break;

      case 'vendedor':
        this.chartType = 'bar';
        this.cumplimientoService
          .getCumplimientoPorCodigo(this.codigoVendedor, this._filtros)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res) => {
            if (!res || !res.totales) return;
            const vendedor = res.detalle?.[0];
            this.tableData = res.detalle ?? [];
            this.chartData = [{ name: vendedor?.nombre || '', value: res.totales.ventaAcum }];
            this.cdr.detectChanges();
          });
        break;

      case 'item':
        this.chartType = 'bar';
        this.cumplimientoService
          .getProductosPorVendedor(this.codigoVendedor, this._filtros)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res) => {
            const listado = res?.data ?? [];
            this.allItemData = listado;
            this.tableData   = [...listado];
            this.recalcularChart();
          });
        break;
    }
  }
}