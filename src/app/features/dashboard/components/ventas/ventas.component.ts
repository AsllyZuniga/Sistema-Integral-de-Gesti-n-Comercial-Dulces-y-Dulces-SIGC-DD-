import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent, TableComponent],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css']
})
export class VentasComponent implements OnInit, OnDestroy {

  @Input() codigoVendedor!: string;

  // ── Setter: cada vez que el Dashboard cambia filtros, recarga ──
  @Input() set filtros(value: DashboardFilters) {
    this._filtros = value;
    if (this.codigoVendedor) {
      this.cargarVistaActual();
    }
  }
  get filtros(): DashboardFilters { return this._filtros; }
  private _filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin:    '',
    vendedor:    '',
    proveedor:   '',
    categoria:   '',
    ciudad:      '',
  };
  // ──────────────────────────────────────────────────────────────

  private destroy$ = new Subject<void>();

  activeVentasView = 'ventas';
  chartId: string = 'chart-main';
  chartType: 'line' | 'bar' | 'pie' = 'line';
  tableData: any[] = [];
  chartData: any[] = [];

  // ── Filtro interno — Detalle por Item ─────────────────────────
  private allItemData: any[] = [];
  proveedores: string[] = [];
  proveedorSeleccionado: string = '';
  // ──────────────────────────────────────────────────────────────

  readonly ventasViews = [
    { key: 'ventas',    label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad',    label: 'Por Ciudad' },
    { key: 'vendedor',  label: 'Por Vendedor' },
    { key: 'item',      label: 'Detalle por Item' },
  ];

  readonly tableColumns     = ['codVendedor', 'nombre', 'cuotaMes', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly lineasColumns    = ['linea', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly ciudadesColumns  = ['ciudad', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly productosColumns = ['Fecha', 'Proveedor', 'Cod_Item', 'Descripcion', 'Venta_Unid_Cajas', 'Cantidad', 'Subtotal'];

  constructor(
    private cumplimientoService: CumplimientoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarVistaActual();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setVentasView(view: string) {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.cargarVistaActual();
  }

  // ── Filtro interno (solo vista "item") ────────────────────────
  onProveedorChange() {
    this.aplicarFiltro();
    this.recalcularChart();
  }

  private aplicarFiltro() {
    this.tableData = this.proveedorSeleccionado
      ? this.allItemData.filter(r => r.Proveedor === this.proveedorSeleccionado)
      : [...this.allItemData];
    this.cdr.detectChanges();
  }

  private recalcularChart() {
    const fuente = this.proveedorSeleccionado
      ? this.allItemData.filter(r => r.Proveedor === this.proveedorSeleccionado)
      : this.allItemData;

    const agg = new Map<string, number>();
    for (const row of fuente) {
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
  // ──────────────────────────────────────────────────────────────

  cargarVistaActual() {
    if (!this.codigoVendedor) return;

    this.tableData             = [];
    this.chartData             = [];
    this.allItemData           = [];
    this.proveedores           = [];
    this.proveedorSeleccionado = '';
    this.chartId = 'chart-' + this.activeVentasView + '-' + Date.now();

    // ── VENTAS ──────────────────────────────────────────────────
    if (this.activeVentasView === 'ventas') {
      this.chartType = 'line';
      this.cumplimientoService
        .getCumplimientoPorCodigo(this.codigoVendedor, this._filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          if (!res) return;
          this.tableData = [res];
          this.chartData = [
            { name: 'Venta',      value: res.ventaAcum },
            { name: 'Cuota',      value: res.cuotaMes },
            { name: 'Proyección', value: res.proyeccionVenta }
          ];
          this.cdr.detectChanges();
        });
    }

    // ── PROVEEDOR ────────────────────────────────────────────────
    else if (this.activeVentasView === 'proveedor') {
      this.chartType = 'bar';
      this.cumplimientoService
        .getLineasPorVendedor(this.codigoVendedor, this._filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          const listado = res?.detallePorLinea ?? [];
          this.tableData = listado;
          this.chartData = listado.map((item: any) => ({
            name: item.linea,
            value: item.ventaAcum
          }));
          this.cdr.detectChanges();
        });
    }

    // ── CIUDAD ───────────────────────────────────────────────────
    else if (this.activeVentasView === 'ciudad') {
      this.chartType = 'pie';
      this.cumplimientoService
        .getCiudadesPorVendedor(this.codigoVendedor, this._filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          const listado = res?.detallePorCiudad ?? [];
          this.tableData = listado;
          this.chartData = listado.map((item: any) => ({
            name: item.ciudad,
            value: item.ventaAcum
          }));
          this.cdr.detectChanges();
        });
    }

    // ── VENDEDOR ─────────────────────────────────────────────────
    else if (this.activeVentasView === 'vendedor') {
      this.chartType = 'bar';
      this.cumplimientoService
        .getCumplimientoPorCodigo(this.codigoVendedor, this._filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          if (!res) return;
          this.tableData = [res];
          this.chartData = [{ name: res.nombre, value: res.ventaAcum }];
          this.cdr.detectChanges();
        });
    }

    // ── DETALLE POR ITEM ─────────────────────────────────────────
    else if (this.activeVentasView === 'item') {
      this.chartType = 'bar';
      this.cumplimientoService
        .getProductosPorVendedor(this.codigoVendedor, this._filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {
          const listado = res?.data ?? [];

          this.allItemData = listado;

          this.proveedores = [
            ...new Set<string>(listado.map((r: any) => r.Proveedor).filter(Boolean))
          ].sort();

          this.tableData = [...listado];
          this.recalcularChart();
        });
    }
  }
}