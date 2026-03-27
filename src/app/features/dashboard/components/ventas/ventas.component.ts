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
  private cumplimientoService = inject(CumplimientoService);
  private semanaService = inject(CumplimientoSemanaService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  @Input() set codigoVendedor(value: string) {
    this._codigoVendedor = value;
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

  private readonly todasLasVistas = [
    { key: 'ventas', label: 'Ventas' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad', label: 'Por Ciudad' },
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
    return ['codVendedor', 'nombre', this.cuotaColumn, 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  }

  readonly ciudadesColumns = ['ciudad', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];
  readonly productosColumns = ['Fecha', 'Proveedor', 'Cod_Item', 'Descripcion', 'Venta_Unid_Cajas', 'Cantidad', 'Subtotal'];

  private readonly cuotaLineaMock: Record<string, number> = {
    confiteria: 2500000,
    chocolates: 3000000,
    galleteria: 2200000,
    snacks: 1800000,
    bebidas: 2600000,
  };

  readonly lineasColumns = ['linea', 'cuotaLinea', 'ventaAcum', 'porcCump', 'proyeccionVenta', 'porcCumProy'];

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
    this.chartId = 'chart-' + this.activeVentasView + '-' + Date.now();
    this.cdr.detectChanges();
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

  private repararTextoCiudad(valor: unknown): string {
    const txt = String(valor ?? '').trim();
    if (!txt) return '';

    return txt
      .replace(/�/g, 'a')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizarTexto(valor: unknown): string {
    return this.repararTextoCiudad(valor)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s.,-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private filtrarPorCiudadSeleccionada(listado: any[]): any[] {
    const ciudadFiltroRaw = String(this._filtros.ciudadNombre ?? this._filtros.ciudad ?? '').trim();
    const ciudadFiltro = this.normalizarTexto(ciudadFiltroRaw);

    if (!ciudadFiltro) return listado;

    return listado.filter((item: any) => {
      const ciudadItem = this.normalizarTexto(item?.ciudad ?? '');
      return ciudadItem === ciudadFiltro;
    });
  }

  private normalizarLinea(linea: unknown): string {
    return String(linea ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private mapearCuotaPorLinea(listado: any[]): any[] {
    return listado.map((item: any) => {
      const key = this.normalizarLinea(item?.linea);
      const cuotaLinea = item?.cuotaLinea ?? this.cuotaLineaMock[key] ?? null;
      return { ...item, cuotaLinea };
    });
  }

  cargarVistaActual(): void {
    if (!this._codigoVendedor) return;

    this.resetearVista();

    const tieneProveedor = !!this._filtros.proveedor;
    const codigoProveedor = this._filtros.proveedor;
    const tieneCiudad = !!(this._filtros.ciudad || this._filtros.ciudadNombre);
    const codigoCiudad = String(this._filtros.ciudad ?? '').trim();

    switch (this.activeVentasView) {
      case 'ventas':
        this.chartType = 'line';

        if (tieneProveedor) {
          this.cumplimientoService
            .getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              const detalle = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              this.tableData = detalle;
              this.chartData = detalle.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
              this.cdr.detectChanges();
            });

        } else if (tieneCiudad) {
          const ciudades$ = this.esSemanal
            ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, this._filtros)
            : codigoCiudad
              ? this.cumplimientoService.getDetallePorCiudad(this._codigoVendedor, codigoCiudad, this._filtros)
              : this.cumplimientoService.getCiudadesPorVendedor(this._codigoVendedor, this._filtros);

          ciudades$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
            const listado = this.filtrarPorCiudadSeleccionada(res?.detallePorCiudad ?? []);
            this.tableData = listado;
            this.chartData = listado.map((i: any) => ({ name: this.repararTextoCiudad(i.ciudad), value: i.ventaAcum }));
            this.cdr.detectChanges();
          });

        } else if (this.esSemanal) {
          this.semanaService
            .getCumplimientoSemanaVendedor(this._filtros)
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
              this.cdr.detectChanges();
            });

        } else {
          this.cumplimientoService
            .getCumplimientoPorCodigo(this._codigoVendedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              if (!res?.totales) return;

              this.tableData = res.detalle ?? [];
              this.chartData = [
                { name: 'Venta', value: res.totales.ventaAcum },
                { name: 'Cuota', value: res.totales.cuotaMes },
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
            .getDetallePorLineaProveedor(this._codigoVendedor, codigoProveedor, this._filtros)
            .pipe(takeUntil(this.destroy$))
            .subscribe((res: any) => {
              const detalle = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              this.tableData = detalle;
              this.chartData = detalle.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
              this.cdr.detectChanges();
            });

        } else {
          const lineas$ = this.esSemanal
            ? this.semanaService.getLineasPorVendedor(this._codigoVendedor, this._filtros)
            : this.cumplimientoService.getLineasPorVendedor(this._codigoVendedor, this._filtros);

          lineas$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
            const listado = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
            this.tableData = listado;
            this.chartData = listado.map((i: any) => ({ name: i.linea, value: i.ventaAcum }));
            this.cdr.detectChanges();
          });
        }
        break;

      case 'ciudad':
        this.chartType = 'pie';

        const ciudades$ = this.esSemanal
          ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, this._filtros)
          : codigoCiudad
            ? this.cumplimientoService.getDetallePorCiudad(this._codigoVendedor, codigoCiudad, this._filtros)
            : this.cumplimientoService.getCiudadesPorVendedor(this._codigoVendedor, this._filtros);

        ciudades$.pipe(takeUntil(this.destroy$)).subscribe((res: any) => {
          const listado = this.filtrarPorCiudadSeleccionada(res?.detallePorCiudad ?? []);
          this.tableData = listado.map((i: any) => ({
            ...i,
            ciudad: this.repararTextoCiudad(i.ciudad),
          }));
          this.chartData = listado.map((i: any) => ({
            name: this.repararTextoCiudad(i.ciudad),
            value: i.ventaAcum,
          }));
          this.cdr.detectChanges();
        });
        break;

      case 'vendedor':
        this.chartType = 'bar';

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

      case 'item':
        this.chartType = 'bar';

        this.cumplimientoService
          .getProductosPorVendedor(this._codigoVendedor, this._filtros)
          .pipe(takeUntil(this.destroy$))
          .subscribe((res: any) => {
            const listado = res?.data ?? [];
            this.allItemData = listado;
            this.tableData = [...listado];
            this.recalcularChart();
          });
        break;
    }
  }
}