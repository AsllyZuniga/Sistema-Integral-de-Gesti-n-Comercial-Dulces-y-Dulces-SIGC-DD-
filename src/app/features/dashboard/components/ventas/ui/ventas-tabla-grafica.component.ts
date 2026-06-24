import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartComponent } from '../../../../../shared/components/chart';
import { TableComponent } from '../../../../../shared/components/table/table.component';

@Component({
  selector: 'app-ventas-tabla-grafica',
  standalone: true,
  imports: [CommonModule, ChartComponent, TableComponent],
  template: `
    <div class="stack-layout">
      @if (showTotals && data.length > 0) {
        <div [class]="totalsClass">
          @if (totalCuotaLabel) {
            <span class="categoria-total-pill">
              Total Cuota: <strong>{{ totalCuotaLabel }}</strong>
            </span>
          }
          @if (totalAcumuladoLabel) {
            <span class="categoria-total-pill" [style.margin-left.px]="totalCuotaLabel ? 12 : 0">
              Total Acumulado: <strong>{{ totalAcumuladoLabel }}</strong>
            </span>
          }
        </div>
      }

      @if (showCountBadge) {
        <div class="filtro-bar">
          <span class="filtro-badge">
            {{ data.length }} registro{{ data.length !== 1 ? 's' : '' }}
          </span>
        </div>
      }

      <div [class]="tableScrollClass">
        @if (data.length > 0) {
          <app-table [columns]="columns" [data]="data"></app-table>
        } @else {
          <div class="placeholder">{{ emptyMessage }}</div>
        }
      </div>

      <ng-content select="[ventas-tabla-footer]"></ng-content>

      @if (chartData.length > 0) {
        <div class="grafica-container">
          @if (kpiLabel && kpiValue) {
            <div class="proveedor-kpis">
              <article class="proveedor-kpi-card">
                <span class="proveedor-kpi-label">{{ kpiLabel }}</span>
                <strong class="proveedor-kpi-value">{{ kpiValue }}</strong>
              </article>
            </div>
          }

          @if (chartTitle) {
            <div [class]="chartHeadClass">
              <h4>{{ chartTitle }}</h4>
            </div>
          }

          <app-chart
            [chartId]="chartId"
            [data]="chartData"
            [type]="chartType"
            [showLegend]="showLegend"
            [label]="chartLabel"
          ></app-chart>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentasTablaGraficaComponent {
  @Input() columns: string[] = [];
  @Input() data: any[] = [];
  @Input() chartData: any[] = [];
  @Input() chartId = 'chart-main';
  @Input() chartType: 'line' | 'bar' | 'pie' = 'line';
  @Input() chartLabel = 'Ventas';
  @Input() chartTitle = '';
  @Input() chartHeadClass = 'proveedor-chart-head';
  @Input() showLegend = true;
  @Input() showCountBadge = false;
  @Input() emptyMessage = 'No hay datos disponibles para los filtros seleccionados.';
  @Input() tableScrollClass = 'tabla-scroll';
  @Input() kpiLabel = '';
  @Input() kpiValue = '';
  @Input() showTotals = false;
  @Input() totalsClass = 'categoria-totales';
  @Input() totalCuotaLabel = '';
  @Input() totalAcumuladoLabel = '';
}
