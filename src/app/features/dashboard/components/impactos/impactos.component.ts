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
import { Subject, Subscription, forkJoin, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VentasTablaGraficaComponent } from '../ventas/ui/ventas-tabla-grafica.component';
import { ImpactosService, ImpactosFiltros } from './services/impactos.service';
import { IMPACTOS_VIEWS, obtenerVistasImpactosPorRol } from './config/impactos-view.config';
import { ImpactosViewOption } from './models/impactos.model';
import {
  ImpactoBaseRow,
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
  impactosViews: ImpactosViewOption[] = IMPACTOS_VIEWS;
  activeImpactosView = 'vendedor';

  vendedorColumns = ['codVendedor', 'nombre', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];
  proveedorColumns = ['proveedor', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];
  categoriaColumns = ['categoria', 'cuotaImpactos', 'impactos', 'porcCump', 'faltan'];

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

  totalFaltanProveedores = 0;
  totalFaltanCategorias = 0;
  totalFaltanVendedores = 0;

  private destroy$ = new Subject<void>();
  private cargaImpactos?: Subscription;
  private claveCargaEnCurso = '';
  cargandoImpactos = false;

  @Input() codigosVendedores: string[] = [];
  @Input() rolId = 0;

  @Output() resumenCambio = new EventEmitter<{
    ventaAcum: number;
    cuota?: number;
    porcCump?: number;
    faltan?: number;
  }>();

  private _filtros: DashboardFilters | null = null;
  private filtrosInicializados = false;

  @Input() set filtrosActivos(value: DashboardFilters | null) {
    if (value) {
      this._filtros = value;
      this.filtrosInicializados = true;
      this.cargarImpactos();
    }
  }

  constructor(
    private impactosService: ImpactosService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.impactosViews = obtenerVistasImpactosPorRol(this.rolId);
    if (this.impactosViews.length && !this.impactosViews.some(v => v.key === this.activeImpactosView)) {
      this.activeImpactosView = this.impactosViews[0].key;
    }
    if (!this.filtrosInicializados) this.cargarImpactos();
  }

  ngOnDestroy(): void {
    this.cargaImpactos?.unsubscribe();
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
      
      if (f.vendedores && f.vendedores.length > 0) {
        filtros.vendedor = f.vendedores.join(',');
      } else if (f.vendedor) {
        filtros.vendedor = f.vendedor;
      }
      
      if (f.proveedores && f.proveedores.length > 0) {
        filtros.proveedor = f.proveedores.join(',');
      } else if (f.proveedor) {
        filtros.proveedor = f.proveedor;
      }
      
      if (f.categorias && f.categorias.length > 0) {
        filtros.categoria = f.categorias.join(',');
      } else if (f.categoria) {
        filtros.categoria = f.categoria;
      }
    }
    return filtros;
  }

  private cargarImpactos(): void {
    const filtros = this.buildImpactosFiltros();
    const claveFiltros = JSON.stringify(filtros);
    if (this.cargandoImpactos && this.claveCargaEnCurso === claveFiltros) return;

    this.cargaImpactos?.unsubscribe();
    this.claveCargaEnCurso = claveFiltros;
    this.cargandoImpactos = true;
    this.proveedorData = [];
    this.categoriaData = [];
    this.vendedorData = [];
    this.proveedorChartData = [];
    this.categoriaChartData = [];
    this.vendedorChartData = [];

    // Las tres consultas se ejecutan en paralelo, pero se actualizan juntas.
    // Al cancelar la suscripción anterior, una respuesta vieja no puede
    // sobrescribir los datos de un filtro más reciente.
    this.cargaImpactos = forkJoin({
      proveedor: this.impactosService.getImpactosPorProveedor(filtros).pipe(
        catchError(() => of({ rows: [] } as any)),
      ),
      categoria: this.impactosService.getImpactosPorCategoria(filtros).pipe(
        catchError(() => of({ rows: [] } as any)),
      ),
      vendedor: this.impactosService.getImpactosPorVendedor(filtros).pipe(
        catchError(() => of({ rows: [] } as any)),
      ),
    }).pipe(takeUntil(this.destroy$)).subscribe(({ proveedor, categoria, vendedor }) => {
      const proveedores = (proveedor.rows ?? []) as ImpactoProveedorRow[];
      const categorias = this.filtrarPorCodigosVendedores(
        (categoria.rows ?? []) as ImpactoCategoriaRow[],
      );
      const vendedores = this.filtrarPorCodigosVendedores(
        (vendedor.rows ?? []) as ImpactoVendedorRow[],
      );

      this.proveedorData = this.consolidarPorDimension(proveedores, 'proveedor');
      this.categoriaData = this.consolidarPorDimension(categorias, 'categoria');
      this.vendedorData = this.separarCodigoNombreVendedor(
        this.consolidarPorDimension(vendedores, 'vendedor'),
      );
      this.actualizarResumenDimension(proveedores, 'proveedor');
      this.actualizarResumenDimension(categorias, 'categoria');
      this.actualizarResumenDimension(vendedores, 'vendedor');
      this.cargandoImpactos = false;
      this.cdr.markForCheck();
      this.emitirResumenCambio();
    });
  }

  private actualizarResumenDimension(
    rows: ImpactoBaseRow[],
    dimension: 'proveedor' | 'categoria' | 'vendedor',
  ): void {
    const cuota = rows.reduce((sum, item) => sum + (Number(item?.cuotaImpactos ?? 0) || 0), 0);
    const impactos = rows.reduce((sum, item) => sum + (Number(item?.impactos ?? 0) || 0), 0);
    const faltan = rows.reduce((sum, item) => sum + (Number(item?.faltan ?? 0) || 0), 0);
    const chartData = this.agruparPorDimension(rows as any, dimension);
    const top = [...chartData].sort((a, b) => b.value - a.value).slice(0, 15);
    const topTotal = top.reduce((sum, item) => sum + item.value, 0);

    if (dimension === 'proveedor') {
      this.totalCuotaProveedores = cuota;
      this.totalAcumuladoProveedores = impactos;
      this.totalFaltanProveedores = faltan;
      this.totalTopProveedores = topTotal;
      this.proveedorChartData = top;
    } else if (dimension === 'categoria') {
      this.totalCuotaCategorias = cuota;
      this.totalAcumuladoCategorias = impactos;
      this.totalFaltanCategorias = faltan;
      this.totalTopCategorias = topTotal;
      this.categoriaChartData = top;
    } else {
      this.totalCuotaVendedores = cuota;
      this.totalAcumuladoVendedores = impactos;
      this.totalFaltanVendedores = faltan;
      this.totalTopVendedores = topTotal;
      this.vendedorChartData = top;
    }
  }

  private consolidarPorDimension<T extends ImpactoBaseRow>(
    rows: T[],
    dimension: 'proveedor' | 'categoria' | 'vendedor',
  ): T[] {
    const map = new Map<string, T>();
    for (const row of rows) {
      const key = String((row as any)[dimension] ?? '');
      const existente = map.get(key);
      if (!existente) {
        map.set(key, { ...row });
        continue;
      }
      existente.cuotaImpactos = (Number(existente.cuotaImpactos) || 0) + (Number(row.cuotaImpactos) || 0);
      existente.impactos = (Number(existente.impactos) || 0) + (Number(row.impactos) || 0);
    }
    for (const row of map.values()) {
      const cuota = Number(row.cuotaImpactos) || 0;
      const impactos = Number(row.impactos) || 0;
      row.porcCump = cuota > 0 ? Math.round((impactos / cuota) * 1000) / 10 : 0;
      row.faltan = Math.max(cuota - impactos, 0);
    }
    return Array.from(map.values());
  }

  private separarCodigoNombreVendedor(rows: ImpactoVendedorRow[]): ImpactoVendedorRow[] {
    return rows.map((row) => {
      const [codVendedor, ...resto] = String(row.vendedor ?? '').split(' - ');
      return {
        ...row,
        codVendedor: codVendedor?.trim() ?? '',
        nombre: resto.join(' - ').trim(),
      };
    });
  }

  private filtrarPorCodigosVendedores<T extends ImpactoBaseRow>(rows: T[]): T[] {
    if (!this.codigosVendedores.length) return rows;
    return rows.filter((d) => {
      const codigo = String(d.vendedor).split(' - ')[0]?.trim();
      return this.codigosVendedores.includes(codigo);
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
    let faltan = 0;

    if (vista === 'proveedor') {
      ventaAcum = this.totalAcumuladoProveedores;
      cuota = this.totalCuotaProveedores;
      faltan = this.totalFaltanProveedores;
    } else if (vista === 'categoria') {
      ventaAcum = this.totalAcumuladoCategorias;
      cuota = this.totalCuotaCategorias;
      faltan = this.totalFaltanCategorias;
    } else {
      ventaAcum = this.totalAcumuladoVendedores;
      cuota = this.totalCuotaVendedores;
      faltan = this.totalFaltanVendedores;
    }

    const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

    this.resumenCambio.emit({
      ventaAcum,
      cuota,
      porcCump,
      faltan,
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
