import {
  Component, Input,
  AfterViewInit, OnChanges, SimpleChanges, OnDestroy
} from '@angular/core';
import { Chart, ChartOptions } from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<canvas [id]="chartId" style="width:100%;"></canvas>`
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() chartId: string = 'chart-' + Math.random().toString(36).substring(2, 8);
  @Input() type: 'bar' | 'line' | 'pie' = 'bar';
  @Input() data: { name: string; value: number }[] = [];
  @Input() label: string = 'Datos';

  private chartInstance: Chart | null = null;

  ngAfterViewInit() {
    this.buildChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.chartInstance?.destroy();
    this.chartInstance = null;
    setTimeout(() => this.buildChart(), 0);
  }

  ngOnDestroy() {
    this.chartInstance?.destroy();
  }

  // ── Paleta de colores ─────────────────────────────
  private readonly COLORS = [
    '#2563eb', '#16a34a', '#d97706', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#ea580c',
    '#0284c7', '#9333ea', '#15803d', '#b45309'
  ];

  private getColors(count: number): string[] {
    return Array.from({ length: count }, (_, i) => this.COLORS[i % this.COLORS.length]);
  }

  // ── Acortar labels largos ─────────────────────────
  private truncate(str: string, max = 18): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  private buildChart() {
    const canvas = document.getElementById(this.chartId) as HTMLCanvasElement;
    if (!canvas || !this.data?.length) return;

    // Filtrar valores inválidos (null, undefined, NaN)
    const cleanData = this.data.filter(d => d.value != null && !isNaN(d.value));
    if (!cleanData.length) return;

    const labels = cleanData.map(d => this.truncate(d.name));
    const values = cleanData.map(d => d.value);
    const colors = this.getColors(cleanData.length);

    // ── Calcular mín/máx para escala coherente ────────
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    // Para bar/line: eje Y siempre desde 0 (o desde minVal si hay negativos reales)
    const yMin = minVal < 0 ? Math.floor(minVal * 1.1) : 0;
    const yMax = Math.ceil(maxVal * 1.15);

    // ── Opciones según tipo ───────────────────────────
    const isBar  = this.type === 'bar';
    const isLine = this.type === 'line';
    const isPie  = this.type === 'pie';

    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: isPie ? 1.4 : (isLine && cleanData.length <= 5 ? 2.5 : 1.6),

      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 12, family: "'Plus Jakarta Sans', 'Inter', sans-serif" },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed?.y ?? ctx.parsed;
              if (isPie) {
                // Para pie, ctx.parsed es el valor directo
                const num = typeof val === 'number' ? val : ctx.raw as number;
                return ' ' + this.formatNumber(num);
              }
              return ' ' + this.formatNumber(typeof val === 'number' ? val : 0);
            }
          }
        }
      },

      ...(isBar || isLine ? {
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              maxRotation: 45,
              minRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            min: yMin,
            max: yMax,
            grid: {
              color: 'rgba(0,0,0,0.05)'
            },
            ticks: {
              font: { size: 11 },
              callback: (val) => this.formatNumber(val as number)
            }
          }
        }
      } : {})
    };

    this.chartInstance = new Chart(canvas, {
      type: this.type,
      data: {
        labels,
        datasets: [{
          label: this.label,
          data: values,
          backgroundColor: isPie || isBar ? colors : colors[0],
          borderColor: isLine ? colors[0] : 'transparent',
          borderWidth: isLine ? 2 : 0,
          borderRadius: isBar ? 4 : 0,
          pointBackgroundColor: isLine ? colors[0] : undefined,
          pointRadius: isLine ? 4 : 0,
          tension: isLine ? 0.3 : 0,
          fill: false
        }]
      },
      options
    });
  }

  // ── Formato de números en tooltips y eje Y ────────
  private formatNumber(val: number): string {
    if (Math.abs(val) >= 1_000_000)
      return '$\u00a0' + (val / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1_000)
      return '$\u00a0' + (val / 1_000).toFixed(0) + 'K';
    return val.toLocaleString('es-CO');
  }
}