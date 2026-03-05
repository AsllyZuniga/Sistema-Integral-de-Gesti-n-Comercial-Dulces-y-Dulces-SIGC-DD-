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
  template: `<canvas #canvas style="width:100%;"></canvas>`,
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>; // 👈 ViewChild

  @Input() type: 'bar' | 'line' | 'pie' = 'bar';
  @Input() data: { name: string; value: number }[] = [];
  @Input() label: string = 'Datos';
  @Input() chartId?: string;

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
    '#2563eb',
    '#16a34a',
    '#d97706',
    '#7c3aed',
    '#0891b2',
    '#db2777',
    '#65a30d',
    '#ea580c',
    '#0284c7',
    '#9333ea',
    '#15803d',
    '#b45309',
  ];

  private getColors(count: number): string[] {
    return Array.from({ length: count }, (_, i) => this.COLORS[i % this.COLORS.length]);
  }

  private truncate(str: string, max = 18): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  private buildChart() {
    const canvas = this.canvasRef?.nativeElement; // 👈 desde ViewChild
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
      maintainAspectRatio: true,
      aspectRatio: isPie ? 1.4 : 1.6,
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed?.y ?? ctx.parsed;
              return ' ' + this.formatNumber(typeof val === 'number' ? val : 0);
            },
          },
        },
      },
      ...(isBar || isLine
        ? {
            scales: {
              y: {
                min: yMin,
                max: yMax,
                ticks: {
                  callback: (val) => this.formatNumber(val as number),
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
            backgroundColor: isPie || isBar ? colors : colors[0],
            borderColor: isLine ? colors[0] : 'transparent',
            borderWidth: isLine ? 2 : 0,
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
}
