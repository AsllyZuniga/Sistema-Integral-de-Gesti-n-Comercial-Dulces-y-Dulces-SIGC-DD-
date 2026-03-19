import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { AuthService } from '../../../../core/services/auth.service';
import { TipoCuota } from '../../../cumplientosCuota/cumplimientos.component';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent, TableComponent],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
})
export class VentasComponent implements OnInit, OnDestroy {

  // ─── Inyección con inject() ───────────────────────────────────────────────────
  private cumplimientoService = inject(CumplimientoService);       // MES
  private semanaService       = inject(CumplimientoSemanaService); // SEMANA
  private authService         = inject(AuthService);
  private cdr                 = inject(ChangeDetectorRef);

  // ─── Input: codigoVendedor ────────────────────────────────────────────────────
  @Input() set codigoVendedor(value: string) {
    console.log('📦 [VentasComponent] codigoVendedor SET:', value);
    this._codigoVendedor = value;
    if (value && this.iniciado) {
      this.cargarVistaActual();
    }
  }
  get codigoVendedor(): string {
    return this._codigoVendedor;
  }
  private _codigoVendedor = '';

  // ─── Input: tipoCuota — SETTER garantiza recarga al cambiar Mes ↔ Semana ──────
  @Input() set tipoCuota(value: TipoCuota) {
    const cambio = this._tipoCuota !== value;
    console.log('🔄 [VentasComponent] tipoCuota SET:', value, '| cambio:', cambio, '| codigo:', this._codigoVendedor, '| iniciado:', this.iniciado);
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

  // ─── Input: filtros ───────────────────────────────────────────────────────────
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
    fechaInicio: '', fechaFin: '', vendedor: '',
    proveedor: '', categoria: '', ciudad: '', linea: '',
  };

  // ─── Estado interno ───────────────────────────────────────────────────────────
  private destroy$  = new Subject<void>();
  private iniciado  = false;

  rolId             = 0;
  activeVentasView  = 'ventas';
  chartId           = 'chart-main';
  chartType: 'line' | 'bar' | 'pie' = 'line';
  tableData: any[]  = [];
  chartData: any[]  = [];
  private allItemData: any[] = [];

  // ─── Vistas disponibles ───────────────────────────────────────────────────────
  private readonly todasLasVistas = [
    { key: 'ventas',    label: 'Ventas'           },
    { key: 'proveedor', label: 'Por Proveedor'    },
    { key: 'ciudad',    label: 'Por Ciudad'       },
    { key: 'vendedor',  label: 'Por Vendedor'     },
    { key: 'item',      label: 'Detalle por Item' },
  ];

  get ventasViews() {
    if (this.rolId === 3) {
      return this.todasLasVistas.filter(v => v.key !== 'ventas' && v.key !== 'vendedor');
    }
    return this.todasLasVistas;
  }

  // ─── Columnas ─────────────────────────────────────────────────────────────────
  get cuotaColumn(): string {
    return this._tipoCuota === 'semanal'
      ? 'cuotaSemana'
      : this._tipoCuota === 'diaria'
      ? 'cuotaDiaria'
      : 'cuotaMes';
  }

  get tableColumns(): string[] {
    return ['codVendedor', 'nombre', this.cuotaColumn, 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  }

  readonly lineasColumns    = ['linea', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly ciudadesColumns  = ['ciudad', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly productosColumns = ['Fecha', 'Proveedor', 'Cod_Item', 'Descripcion', 'Venta_Unid_Cajas', 'Cantidad', 'Subtotal'];

  // ─── Constructor ──────────────────────────────────────────────────────────────
  constructor() {
    const usuario         = this.authService.getVendedor();
    this.rolId            = Number(usuario?.rol?.idRol ?? usuario?.idRol ?? 0);
    this.activeVentasView = this.rolId === 3 ? 'proveedor' : 'ventas';
  }

  // ─── Ciclo de vida ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.iniciado = true;
    console.log('🚀 [VentasComponent] ngOnInit | codigo:', this._codigoVendedor, '| tipoCuota:', this._tipoCuota);
    if (this._codigoVendedor) {
      this.cargarVistaActual();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /** ¿Estamos en modo semanal? */
  get esSemanal(): boolean {
    return this._tipoCuota === 'semanal';
  }

  /** Limpia datos para mostrar estado de carga */
  private resetearVista(): void {
    this.tableData   = [];
    this.chartData   = [];
    this.allItemData = [];
    this.chartId     = 'chart-' + this.activeVentasView + '-' + Date.now();
    this.cdr.detectChanges();
  }

  // ─── Cambio de tab ────────────────────────────────────────────────────────────
  setVentasView(view: string): void {
    if (this.activeVentasView === view) return;
    this.activeVentasView = view;
    this.cargarVistaActual();
  }

  // ─── Recalcula gráfico top 10 para vista "item" ───────────────────────────────
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

  // ─── Carga principal ──────────────────────────────────────────────────────────
  cargarVistaActual(): void {
    if (!this._codigoVendedor) return;

    console.log('⚡ [VentasComponent] cargarVistaActual | vista:', this.activeVentasView, '| tipoCuota:', this._tipoCuota, '| esSemanal:', this.esSemanal, '| codigo:', this._codigoVendedor);

    this.resetearVista();

    const tieneProveedor  = !!this._filtros.proveedor;
    const codigoProveedor = this._filtros.proveedor;

    switch (this.activeVentasView) {

      // ── VENTAS GENERALES ──────────────────────────────────────────────────────
      case 'ventas':
        this.chartType = 'line';

        if (tieneProveedor) {
          // ⚠ Solo MES — no existe endpoint de proveedor en SEMANA
          this.cumplimientoService
            .getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              const detalle  = res?.detallePorLinea ?? [];
              this.tableData = detalle;
              this.chartData = detalle.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
              this.cdr.detectChanges();
            });

        } else if (this.esSemanal) {
          // ── SEMANA: /semana/cumplimiento/front/me ─────────────────────────────
          this.semanaService
            .getCumplimientoSemanaVendedor(this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              const d = (res?.detalle ?? []).find((v: any) => v.codVendedor !== 'TOTALES');
              if (!d) return;
              this.tableData = [d];
              this.chartData = [
                { name: 'Venta',      value: d.ventaAcum      },
                { name: 'Cuota',      value: d.cuotaSemana    },
                { name: 'Proyección', value: d.proyeccionVenta },
              ];
              this.cdr.detectChanges();
            });

        } else {
          // ── MES: /mes/cumplimiento/front/me ───────────────────────────────────
          this.cumplimientoService
            .getCumplimientoPorCodigo(this._codigoVendedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              if (!res?.totales) return;
              this.tableData = res.detalle ?? [];
              this.chartData = [
                { name: 'Venta',      value: res.totales.ventaAcum      },
                { name: 'Cuota',      value: res.totales.cuotaMes       },
                { name: 'Proyección', value: res.totales.proyeccionVenta },
              ];
              this.cdr.detectChanges();
            });
        }
        break;

      // ── POR PROVEEDOR / LÍNEA ─────────────────────────────────────────────────
      case 'proveedor':
        this.chartType = 'bar';

        if (tieneProveedor) {
          // ⚠ Solo MES
          this.cumplimientoService
            .getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              const detalle  = res?.detallePorLinea ?? [];
              this.tableData = detalle;
              this.chartData = detalle.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
              this.cdr.detectChanges();
            });

        } else {
          // ── SEMANA: /semana/cumplimiento/lineas/:codigo
          // ── MES:    /mes/cumplimiento/vendedor/:codigo/lineas
          const lineas$ = this.esSemanal
            ? this.semanaService.getLineasPorVendedor(this._codigoVendedor, this._filtros)
            : this.cumplimientoService.getLineasPorVendedor(this._codigoVendedor, this._filtros);

          lineas$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
            const listado  = res?.detallePorLinea ?? [];
            this.tableData = listado;
            this.chartData = listado.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
            this.cdr.detectChanges();
          });
        }
        break;

      // ── POR CIUDAD ────────────────────────────────────────────────────────────
      case 'ciudad':
        this.chartType = 'pie';

        // ── SEMANA: /semana/cumplimiento/ciudades/:codigo
        // ── MES:    /mes/cumplimiento/vendedor/:codigo/ciudades
        const ciudades$ = this.esSemanal
          ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, this._filtros)
          : this.cumplimientoService.getCiudadesPorVendedor(this._codigoVendedor, this._filtros);

        ciudades$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
          const listado  = res?.detallePorCiudad ?? [];
          this.tableData = listado;
          this.chartData = listado.map((i: any) => ({ name: i.ciudad, value: i.ventaAcum }));
          this.cdr.detectChanges();
        });
        break;

      // ── POR VENDEDOR ──────────────────────────────────────────────────────────
      case 'vendedor':
        this.chartType = 'bar';

        // ⚠ Solo MES — no existe endpoint equivalente en SEMANA
        this.cumplimientoService
          .getCumplimientoPorCodigo(this._codigoVendedor, this._filtros)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res: any) => {
            if (!res?.totales) return;
            const vendedor = res.detalle?.[0];
            this.tableData = res.detalle ?? [];
            this.chartData = [{ name: vendedor?.nombre || '', value: res.totales.ventaAcum }];
            this.cdr.detectChanges();
          });
        break;

      // ── DETALLE POR ITEM ──────────────────────────────────────────────────────
      case 'item':
        this.chartType = 'bar';

        // ⚠ Solo MES — getProductosPorVendedor no existe en SEMANA
        this.cumplimientoService
          .getProductosPorVendedor(this._codigoVendedor, this._filtros)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res: any) => {
            const listado    = res?.data ?? [];
            this.allItemData = listado;
            this.tableData   = [...listado];
            this.recalcularChart();
          });
        break;
    }
  }
}