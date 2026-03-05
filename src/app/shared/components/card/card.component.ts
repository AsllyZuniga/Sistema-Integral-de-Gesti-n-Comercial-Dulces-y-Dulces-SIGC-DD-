import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card" [attr.data-color]="color">
      <span class="card-icon material-symbols-rounded">{{ icon }}</span>
      <p class="title">{{ title }}</p>
      <h2>{{ formattedValue }}</h2>
    </div>
  `,
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnChanges {
  @Input() title!: string;
  @Input() value!: string | number;

  icon: string = '';
  color: string = 'blue';
  formattedValue: string = '';

  private configMap: { [key: string]: { icon: string; color: string } } = {
    'total venta mes': { icon: 'paid',          color: 'blue'   },
    'total cuota':     { icon: 'target',         color: 'violet' },
    'cumplimiento':    { icon: 'monitoring',     color: 'green'  },
    'proyección':      { icon: 'rocket_launch',  color: 'orange' },
    'proyeccion':      { icon: 'rocket_launch',  color: 'orange' },
    'ventas':          { icon: 'storefront',     color: 'blue'   },
    'clientes':        { icon: 'groups',         color: 'violet' },
    'pedidos':         { icon: 'deployed_code',  color: 'green'  },
  };

  ngOnChanges(): void {
    const key = (this.title || '').toLowerCase().trim();
    const config = this.configMap[key] ?? { icon: 'dashboard', color: 'blue' };
    this.icon  = config.icon;
    this.color = config.color;
    this.formattedValue = this.formatValue(this.value);
  }

  private formatValue(val: string | number): string {
    if (val === null || val === undefined) return '—';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    if (this.title?.toLowerCase().includes('cumpl')) {
      return num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0%';
    }
    return '$\u00a0' + num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}