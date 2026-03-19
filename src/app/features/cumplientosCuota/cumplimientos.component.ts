import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type TipoCuota = 'diaria' | 'semanal' | 'mensual';

@Component({
  selector: 'app-cuotas-cumplimiento',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cumplimientos.component.html',
  styleUrls: ['./cumplimientos.component.css'],
})
export class CuotasCumplimientoComponent {
  @Input()  tipoCuota: TipoCuota = 'mensual';
  @Output() tipoCuotaChange = new EventEmitter<TipoCuota>();

  readonly opciones: { key: TipoCuota; label: string }[] = [
    { key: 'diaria',   label: 'Cuota Diaria'   },
    { key: 'semanal',  label: 'Cuota Semanal'  },
    { key: 'mensual',  label: 'Cuota Mensual'  },
  ];

  seleccionar(tipo: TipoCuota): void {
    if (this.tipoCuota === tipo) return;
    this.tipoCuota = tipo;
    this.tipoCuotaChange.emit(tipo);
  }
}