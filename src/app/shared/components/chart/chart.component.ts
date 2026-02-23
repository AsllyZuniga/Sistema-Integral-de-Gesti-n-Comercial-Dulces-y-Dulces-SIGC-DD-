import { Component, Input, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<canvas [id]="chartId"></canvas>`
})
export class ChartComponent implements AfterViewInit {

  @Input() chartId!: string;
  @Input() type: any = 'bar';
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() label: string = '';

  ngAfterViewInit() {
    new Chart(this.chartId, {
      type: this.type,
      data: {
        labels: this.labels,
        datasets: [{
          label: this.label,
          data: this.data,
          backgroundColor: '#2563eb'
        }]
      }
    });
  }
}