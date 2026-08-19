import { Component, ChangeDetectionStrategy, ViewEncapsulation, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { VentasTablaGraficaComponent } from '../ventas/ui/ventas-tabla-grafica.component';
import { ImpactosService } from './services/impactos.service';
import { IMPACTOS_VIEWS } from './config/impactos-view.config';
import {
  ImpactoCategoriaRow,
  ImpactoProveedorRow,
  ImpactoVendedorRow,
} from './models/impactos.model';

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

  private destroy$ = new Subject<void>();

  @Input() codigosVendedores: string[] = [];

  constructor(private impactosService: ImpactosService) {}

  ngOnInit(): void {
    this.cargarImpactos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarImpactos(): void {
    this.impactosService
      .getImpactosPorProveedor()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.proveedorData = res.rows as ImpactoProveedorRow[];
        this.proveedorChartData = this.proveedorData.map((d) => ({
          name: d.proveedor,
          value: d.impactos,
        }));
      });

    this.impactosService
      .getImpactosPorCategoria()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.categoriaData = res.rows as ImpactoCategoriaRow[];
        this.categoriaChartData = this.categoriaData.map((d) => ({
          name: d.categoria,
          value: d.impactos,
        }));
      });

    this.impactosService
      .getImpactosPorVendedor()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const todos = res.rows as ImpactoVendedorRow[];
        this.vendedorData = this.codigosVendedores.length
          ? todos.filter((d) => {
              const codigo = String(d.vendedor).split(' - ')[0]?.trim();
              return this.codigosVendedores.includes(codigo);
            })
          : todos;
        this.vendedorChartData = this.vendedorData.map((d) => ({
          name: d.vendedor,
          value: d.impactos,
        }));
      });
  }

  setImpactosView(key: string): void {
    this.activeImpactosView = key;
  }
}
