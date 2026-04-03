import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-vendedores-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vendedores-table.component.html',
  styleUrls: ['./vendedores-table.component.css'],
})
export class VendedoresTableComponent {
  @Input() esAdmin = false;
  @Input() labelCuota = 'Cuota Mes';
  @Input() labelVentaAcum = 'Venta Mes';
  @Input() campoCuota = 'cuotaMes';
  @Input() cargandoVendedores = false;
  @Input() todosLosVendedores: any[] = [];

  @Output() asignarSupervisor = new EventEmitter<any>();

  onAsignar(vendedor: any): void {
    this.asignarSupervisor.emit(vendedor);
  }
}
