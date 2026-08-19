import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewEncapsulation,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { VentasTablaGraficaComponent } from '../ventas/ui/ventas-tabla-grafica.component';
import { ImpactosService, ImpactosFiltros } from './services/impactos.service';
import { IMPACTOS_VIEWS } from './config/impactos-view.config';
import {
  ImpactoCategoriaRow,
  ImpactoProveedorRow,
  ImpactoVendedorRow,
} from './models/impactos.model';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';

@Component({
  selector: 'app-impactos',
  standalone: true,
  imports: [CommonModule, VentasTablaGraficaComponent],
  templateUrl: './impactos.component.html',
  styleUrls: ['./impactos.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class ImpactosComponent implements OnInit, OnDestroy {
  impactosViews = IMPACTOS_VIEWS;
  activeImpactosView = 'vendedor';

  vendedorColumns = ['vendedor', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];
  proveedorColumns = ['vendedor', 'proveedor', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];
  categoriaColumns = ['vendedor', 'categoria', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];

  proveedorData: ImpactoProveedorRow[] = [];
  categoriaData: ImpactoCategoriaRow[] = [];
  vendedorData: ImpactoVendedorRow[] = [];

  proveedorChartData: { name: string; value: number }[] = [];
  categoriaChartData: { name: string; value: number }[] = [];
  vendedorChartData: { name: string; value: number }[] = [];

  totalTopProveedores = 0;
  totalTopCategorias = 0;
  totalTopVendedores = 0;

  totalCuotaProveedores = 0;
  totalCuotaCategorias = 0;
  totalCuotaVendedores = 0;

  totalAcumuladoProveedores = 0;
  totalAcumuladoCategorias = 0;
  totalAcumuladoVendedores = 0;

  private destroy$ = new Subject<void>();

  @Input() codigosVendedores: string[] = [];

  @Output() resumenCambio = new EventEmitter<{
    ventaAcum: number;
    cuota?: number;
    porcCump?: number;
    proyeccionVenta?: number;
  }>();

  private _filtros: DashboardFilters | null = null;

  @Input() set filtrosActivos(value: DashboardFilters | null) {
    if (value) {
      this._filtros = value;
      this.cargarImpactos();
    }
  }

  constructor(
    private impactosService: ImpactosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarImpactos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public reloadView(): void {
    this.cargarImpactos();
  }

  private buildImpactosFiltros(): ImpactosFiltros {
    const filtros: ImpactosFiltros = {};
    if (this._filtros) {
      const f = this._filtros;
      if (f.fechaInicio) filtros.fechaInicio = f.fechaInicio;
      if (f.fechaFin) filtros.fechaFin = f.fechaFin;
      if (f.vendedor) filtros.vendedor = f.vendedor;
      if (f.proveedor) filtros.proveedor = f.proveedor;
      if (f.categoria) filtros.categoria = f.categoria;
    }
    return filtros;
  }

  private cargarImpactos(): void {
    const filtros = this.buildImpactosFiltros();

    this.impactosService
      .getImpactosPorProveedor(filtros)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoProveedorRow[];
        this.proveedorData = todos;

        this.totalCuotaProveedores = todos.reduce(
          (sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0),
          0,
        );
        this.totalAcumuladoProveedores = todos.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );

        const chartData = this.agruparPorDimension(todos, 'proveedor');
        const topProveedores = [...chartData]
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);

        this.totalTopProveedores = topProveedores.reduce(
          (sum, item) => sum + item.value,
          0,
        );
        this.proveedorChartData = topProveedores;
        this.cdr.markForCheck();
        this.emitirResumenCambio();
      });

    this.impactosService
      .getImpactosPorCategoria(filtros)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoCategoriaRow[];
        this.categoriaData = todos;

        this.totalCuotaCategorias = todos.reduce(
          (sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0),
          0,
        );
        this.totalAcumuladoCategorias = todos.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );

        const chartData = this.agruparPorDimension(todos, 'categoria');
        const topCategorias = [...chartData]
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);

        this.totalTopCategorias = topCategorias.reduce(
          (sum, item) => sum + item.value,
          0,
        );
        this.categoriaChartData = topCategorias;
        this.cdr.markForCheck();
        this.emitirResumenCambio();
      });

    this.impactosService
      .getImpactosPorVendedor(filtros)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoVendedorRow[];
        const filtrados = this.codigosVendedores.length
          ? todos.filter((d) => {
              const codigo = String(d.vendedor).split(' - ')[0]?.trim();
              return this.codigosVendedores.includes(codigo);
            })
          : todos;

        this.vendedorData = filtrados;

        this.totalCuotaVendedores = filtrados.reduce(
          (sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0),
          0,
        );
        this.totalAcumuladoVendedores = filtrados.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );

        const chartData = this.agruparPorDimension(filtrados, 'vendedor');
        const topVendedores = [...chartData]
          .sort((a, b) => b.value - a.value)
          .slice(0, 15);

        this.totalTopVendedores = topVendedores.reduce(
          (sum, item) => sum + item.value,
          0,
        );
        this.vendedorChartData = topVendedores;
        this.cdr.markForCheck();
        this.emitirResumenCambio();
      });
  }

  private agruparPorDimension(
    rows: ImpactoVendedorRow[] | ImpactoProveedorRow[] | ImpactoCategoriaRow[],
    dim: 'vendedor' | 'proveedor' | 'categoria',
  ): { name: string; value: number }[] {
    const map = new Map<string, number>();
    rows.forEach((row: any) => {
      const key = row[dim] as string;
      if (!key) return;
      const current = map.get(key) ?? 0;
      map.set(key, current + (Number(row.impactos ?? 0) || 0));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }

  private emitirResumenCambio(): void {
    const vista = this.activeImpactosView;
    let ventaAcum = 0;
    let cuota = 0;

    if (vista === 'proveedor') {
      ventaAcum = this.totalAcumuladoProveedores;
      cuota = this.totalCuotaProveedores;
    } else if (vista === 'categoria') {
      ventaAcum = this.totalAcumuladoCategorias;
      cuota = this.totalCuotaCategorias;
    } else {
      ventaAcum = this.totalAcumuladoVendedores;
      cuota = this.totalCuotaVendedores;
    }

    const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

    this.resumenCambio.emit({
      ventaAcum,
      cuota,
      porcCump,
      proyeccionVenta: 0,
    });
  }

  setImpactosView(key: string): void {
    this.activeImpactosView = key;
    this.emitirResumenCambio();
  }

  private formatearNumero(valor: unknown): string {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : 0;
    return seguro.toLocaleString('es-CO');
  }

  get totalTopProveedoresLabel(): string {
    return this.formatearNumero(this.totalTopProveedores);
  }

  get totalTopCategoriasLabel(): string {
    return this.formatearNumero(this.totalTopCategorias);
  }

  get totalTopVendedoresLabel(): string {
    return this.formatearNumero(this.totalTopVendedores);
  }

  get totalCuotaProveedoresLabel(): string {
    return this.formatearNumero(this.totalCuotaProveedores);
  }

  get totalCuotaCategoriasLabel(): string {
    return this.formatearNumero(this.totalCuotaCategorias);
  }

  get totalCuotaVendedoresLabel(): string {
    return this.formatearNumero(this.totalCuotaVendedores);
  }

  get totalAcumuladoProveedoresLabel(): string {
    return this.formatearNumero(this.totalAcumuladoProveedores);
  }

  get totalAcumuladoCategoriasLabel(): string {
    return this.formatearNumero(this.totalAcumuladoCategorias);
  }

  get totalAcumuladoVendedoresLabel(): string {
    return this.formatearNumero(this.totalAcumuladoVendedores);
  }
}
