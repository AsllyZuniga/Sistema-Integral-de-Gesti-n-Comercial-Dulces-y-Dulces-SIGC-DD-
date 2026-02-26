import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="card">
    <span class="card-icon" *ngIf="icon">{{ icon }}</span>
    <p class="title">{{ title }}</p>
    <h2>{{ value }}</h2>
  </div>
  `,
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnChanges {
  @Input() title!: string;
  @Input() value!: string | number;

  icon: string = '';

  // Mapea automáticamente el ícono según el título que llega del back
  private iconMap: { [key: string]: string } = {
    'total venta mes':  '💰',
    'total cuota':      '🎯',
    'cumplimiento':     '📊',
    'proyección':       '📈',
    'proyeccion':       '📈',
    'ventas':           '💼',
    'clientes':         '👥',
    'pedidos':          '📦',
  };

  ngOnChanges(): void {
    const key = (this.title || '').toLowerCase().trim();
    this.icon = this.iconMap[key] ?? '📌'; // ícono por defecto si no hay match
  }
}