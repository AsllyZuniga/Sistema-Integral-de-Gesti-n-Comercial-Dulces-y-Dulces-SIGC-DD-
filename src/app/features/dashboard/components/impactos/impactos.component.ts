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

  proveedorColumns = ['proveedor', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];
  categoriaColumns = ['categoria', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];
  vendedorColumns = ['vendedor', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];

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
    if (!this._filtros) return {};
    const f = this._filtros;
    return {
      fechaInicio: f.fechaInicio,
      fechaFin: f.fechaFin,
      vendedor: f.vendedor,
      proveedor: f.proveedor,
      categoria: f.categoria,
    };
  }

  private cargarImpactos(): void {
    const filtros = this.buildImpactosFiltros();

    this.impactosService
      .getImpactosPorProveedor(filtros)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoProveedorRow[];
        const consolidados = this.fusionarDuplicadosProveedor(todos);
        this.proveedorData = consolidados;

        this.totalCuotaProveedores = consolidados.reduce(
          (sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0),
          0,
        );
        this.totalAcumuladoProveedores = consolidados.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );

        const topProveedores = [...consolidados]
          .sort((a, b) => (Number(b?.impactos ?? 0) || 0) - (Number(a?.impactos ?? 0) || 0))
          .slice(0, 15);

        this.totalTopProveedores = topProveedores.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );
        this.proveedorChartData = topProveedores.map((d) => ({
          name: d.proveedor,
          value: d.impactos,
        }));
        this.cdr.markForCheck();
        this.emitirResumenCambio();
      });

    this.impactosService
      .getImpactosPorCategoria(filtros)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoCategoriaRow[];
        const consolidados = this.fusionarDuplicadosCategoria(todos);
        this.categoriaData = consolidados;

        this.totalCuotaCategorias = consolidados.reduce(
          (sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0),
          0,
        );
        this.totalAcumuladoCategorias = consolidados.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );

        const topCategorias = [...consolidados]
          .sort((a, b) => (Number(b?.impactos ?? 0) || 0) - (Number(a?.impactos ?? 0) || 0))
          .slice(0, 15);

        this.totalTopCategorias = topCategorias.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );
        this.categoriaChartData = topCategorias.map((d) => ({
          name: d.categoria,
          value: d.impactos,
        }));
        this.cdr.markForCheck();
        this.emitirResumenCambio();
      });

    this.impactosService
      .getImpactosPorVendedor(filtros)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoVendedorRow[];
        const consolidados = this.fusionarDuplicadosVendedor(todos);
        const filtrados = this.codigosVendedores.length
          ? consolidados.filter((d) => {
              const codigo = String(d.vendedor).split(' - ')[0]?.trim();
              return this.codigosVendedores.includes(codigo);
            })
          : consolidados;

        this.vendedorData = filtrados;

        this.totalCuotaVendedores = filtrados.reduce(
          (sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0),
          0,
        );
        this.totalAcumuladoVendedores = filtrados.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );

        const topVendedores = [...filtrados]
          .sort((a, b) => (Number(b?.impactos ?? 0) || 0) - (Number(a?.impactos ?? 0) || 0))
          .slice(0, 15);

        this.totalTopVendedores = topVendedores.reduce(
          (sum, item) => sum + (Number(item?.impactos ?? 0) || 0),
          0,
        );
        this.vendedorChartData = topVendedores.map((d) => ({
          name: d.vendedor,
          value: d.impactos,
        }));
        this.cdr.markForCheck();
        this.emitirResumenCambio();
      });
  }

  private fusionarDuplicadosVendedor(rows: ImpactoVendedorRow[]): ImpactoVendedorRow[] {
    const merged = new Map<string, ImpactoVendedorRow>();
    rows.forEach((row) => {
      const existing = merged.get(row.vendedor);
      if (existing) {
        existing.cuotaImpactos += row.cuotaImpactos;
        existing.impactos += row.impactos;
        existing.porcCump = existing.cuotaImpactos > 0
          ? Math.round((existing.impactos / existing.cuotaImpactos) * 1000) / 10 : 0;
        existing.faltan = Math.max(existing.cuotaImpactos - existing.impactos, 0);
      } else {
        merged.set(row.vendedor, { ...row });
      }
    });
    return Array.from(merged.values());
  }

  private fusionarDuplicadosProveedor(rows: ImpactoProveedorRow[]): ImpactoProveedorRow[] {
    const merged = new Map<string, ImpactoProveedorRow>();
    rows.forEach((row) => {
      const existing = merged.get(row.proveedor);
      if (existing) {
        existing.cuotaImpactos += row.cuotaImpactos;
        existing.impactos += row.impactos;
        existing.porcCump = existing.cuotaImpactos > 0
          ? Math.round((existing.impactos / existing.cuotaImpactos) * 1000) / 10 : 0;
        existing.faltan = Math.max(existing.cuotaImpactos - existing.impactos, 0);
      } else {
        merged.set(row.proveedor, { ...row });
      }
    });
    return Array.from(merged.values());
  }

  private fusionarDuplicadosCategoria(rows: ImpactoCategoriaRow[]): ImpactoCategoriaRow[] {
    const merged = new Map<string, ImpactoCategoriaRow>();
    rows.forEach((row) => {
      const existing = merged.get(row.categoria);
      if (existing) {
        existing.cuotaImpactos += row.cuotaImpactos;
        existing.impactos += row.impactos;
        existing.porcCump = existing.cuotaImpactos > 0
          ? Math.round((existing.impactos / existing.cuotaImpactos) * 1000) / 10 : 0;
        existing.faltan = Math.max(existing.cuotaImpactos - existing.impactos, 0);
      } else {
        merged.set(row.categoria, { ...row });
      }
    });
    return Array.from(merged.values());
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
