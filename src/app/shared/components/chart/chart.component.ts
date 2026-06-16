import {
  Component,
  Input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { Chart, ChartOptions } from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  standalone: true,
  // ✅ Contenedor con altura máxima para evitar que crezca infinito en pantallas grandes
  template: `
    <div class="chart-wrapper">
      <canvas #canvas></canvas>
    </div>
  `,
  styles: [
    `
      .chart-wrapper {
        width: 100%;
        max-height: 380px;
        height: clamp(240px, 36vh, 380px);
        position: relative;
        min-width: 0;
      }
      canvas {
        width: 100% !important;
        height: 100% !important;
      }
      @media (max-width: 768px) {
        .chart-wrapper {
          height: clamp(240px, 52vh, 340px);
          max-height: 340px;
        }
      }
      @media (max-width: 480px) {
        .chart-wrapper {
          height: clamp(230px, 58vh, 320px);
          max-height: 320px;
        }
      }
    `,
  ],
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() type: 'bar' | 'line' | 'pie' = 'bar';
  @Input() data: { name: string; value: number }[] = [];
  @Input() label: string = 'Datos';
  @Input() chartId?: string;
  @Input() showLegend = true;

  private chartInstance: Chart | null = null;
  private viewReady = false;

  ngAfterViewInit() {
    this.viewReady = true;
    this.buildChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.viewReady) return;
    this.chartInstance?.destroy();
    this.chartInstance = null;
    this.buildChart();
  }

  ngOnDestroy() {
    this.chartInstance?.destroy();
  }

  private readonly COLORS = [
    '#004286', // azul principal marca
    '#f2c94c', // amarillo dorado del logo
    '#14b8a6', // turquesa
    '#f97316', // naranja cálido
    '#22c55e', // verde
    '#8b5cf6', // violeta
    '#ef4444', // rojo suave para contraste
    '#0ea5e9', // celeste
    '#64748b', // azul grisáceo
    '#d946ef', // magenta
    '#84cc16', // lima
    '#a16207', // dorado oscuro
  ];

  private getColors(count: number): string[] {
    return Array.from({ length: count }, (_, i) => this.COLORS[i % this.COLORS.length]);
  }

  private truncate(str: string, max = 18): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  private buildChart() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.data?.length) return;

    const cleanData = this.data.filter((d) => d.value != null && !isNaN(d.value));
    if (!cleanData.length) return;

    const labels = cleanData.map((d) => this.truncate(d.name));
    const values = cleanData.map((d) => d.value);
    const colors = this.getColors(cleanData.length);

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const yMin = minVal < 0 ? Math.floor(minVal * 1.1) : 0;
    const yMax = Math.ceil(maxVal * 1.15);

    const isBar = this.type === 'bar';
    const isLine = this.type === 'line';
    const isPie = this.type === 'pie';

    const options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      plugins: {
        legend: {
          display: this.showLegend,
          position: 'top',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            font: {
              size: 11,
            },
          },
        },
        // Si existe chartjs-plugin-datalabels en el proyecto o por carga global,
        // se fuerza a ocultar los valores encima de las barras.
        datalabels: {
          display: false,
        } as any,
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const val = ctx.parsed?.y ?? ctx.parsed;
              return ' ' + this.formatFullCurrency(typeof val === 'number' ? val : 0);
            },
          },
        },
      } as any,
      ...(isBar || isLine
        ? {
            scales: {
              x: {
                ticks: {
                  autoSkip: true,
                  maxRotation: 35,
                  minRotation: 0,
                  font: {
                    size: 10,
                  },
                },
                grid: {
                  display: false,
                },
              },
              y: {
                min: yMin,
                max: yMax,
                ticks: {
                  callback: (val) => this.formatNumber(val as number),
                  font: {
                    size: 10,
                  },
                },
              },
            },
          }
        : {}),
    };

    this.chartInstance = new Chart(canvas, {
      type: this.type,
      data: {
        labels,
        datasets: [
          {
            label: this.label,
            data: values,
            backgroundColor: isPie || isBar ? colors : 'rgba(0, 66, 134, 0.12)',
            borderColor: isLine ? '#004286' : colors,
            hoverBackgroundColor: colors.map((color) => color + 'dd'),
            borderWidth: isLine ? 3 : 1,
            tension: isLine ? 0.3 : 0,
            fill: false,
          },
        ],
      },
      options,
    });
  }

  private formatNumber(val: number): string {
    if (Math.abs(val) >= 1_000_000) return '$ ' + (val / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(val) >= 1_000) return '$ ' + (val / 1_000).toFixed(0) + 'K';
    return val.toLocaleString('es-CO');
  }

  private formatFullCurrency(val: number): string {
    return `$ ${Number(val || 0).toLocaleString('es-CO')}`;
  }
}

export const CHART_COMPONENT_MODULE = true;
