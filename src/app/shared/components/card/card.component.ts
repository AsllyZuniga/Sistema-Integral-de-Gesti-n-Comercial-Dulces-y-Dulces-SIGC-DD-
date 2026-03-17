import { Component, Input, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None, 
  template: `
    <div class="card" [attr.data-color]="color">
      <span class="card-icon material-symbols-rounded">{{ icon }}</span>
      <p class="title">{{ title }}</p>
      <h2>{{ formattedValue }}</h2>
    </div>
  `,
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnInit {
  @Input() title!: string;
  @Input() set value(val: string | number) {
    this._value = val;
    this.updateFormatting();
  }
  
  get value(): string | number {
    return this._value;
  }

  private _value: string | number = '';
  icon: string = '';
  color: string = 'blue';
  formattedValue: string = '';

  private configMap: { [key: string]: { icon: string; color: string } } = {
  'total venta mes': { icon: 'paid',         color: 'blue'  },
  'total cuota':     { icon: 'target',        color: 'navy'  },
  'cumplimiento':    { icon: 'monitoring',    color: 'olive' },
  'proyección':      { icon: 'rocket_launch', color: 'lime'  },
  'proyeccion':      { icon: 'rocket_launch', color: 'lime'  },
  'ventas':          { icon: 'storefront',    color: 'blue'  },
  'clientes':        { icon: 'groups',        color: 'navy'  },
  'pedidos':         { icon: 'deployed_code', color: 'olive' },
};

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.updateConfig();
  }

  private updateConfig(): void {
    const key = (this.title || '').toLowerCase().trim();
    const config = this.configMap[key] ?? { icon: 'dashboard', color: 'blue' };
    this.icon = config.icon;
    this.color = config.color;
  }

  private updateFormatting(): void {
    this.updateConfig();
    this.formattedValue = this.formatValue(this._value);
    this.cdr.markForCheck();
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