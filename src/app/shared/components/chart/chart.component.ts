import { Component, Input, AfterViewInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<canvas [id]="chartId"></canvas>`
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {

  @Input() chartId: string = 'chart-' + Math.random().toString(36).substring(2, 8);
  @Input() type: any = 'bar';
  @Input() data: { name: string; value: number }[] = [];
  @Input() label: string = 'Datos';

  private chartInstance: Chart | null = null;

  ngAfterViewInit() {
    this.buildChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
    setTimeout(() => this.buildChart(), 0);
  }

  ngOnDestroy() {
    this.chartInstance?.destroy();
  }

  private buildChart() {
    const canvas = document.getElementById(this.chartId) as HTMLCanvasElement;
    if (!canvas || !this.data.length) return;

    const labels = this.data.map(d => d.name);
    const values = this.data.map(d => d.value);

    // aspectRatio según tipo:
    // line con pocos puntos → 3 (más achatado)
    // bar y pie → 1.8 (más cuadrado, se ve bien)
    const isSmallLine = this.type === 'line' && this.data.length <= 5;
    const aspectRatio = isSmallLine ? 3 : 1.8;

    this.chartInstance = new Chart(canvas, {
      type: this.type,
      data: {
        labels,
        datasets: [{
          label: this.label,
          data: values,
          backgroundColor: [
            '#2563eb', '#16a34a', '#dc2626', '#d97706',
            '#7c3aed', '#0891b2', '#db2777', '#65a30d'
          ],
          borderColor: '#1e40af',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio,
        plugins: {
          legend: { position: 'top' }
        }
      }
    });
  }
}