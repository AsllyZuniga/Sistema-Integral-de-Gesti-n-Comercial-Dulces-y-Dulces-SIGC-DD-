import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface VendedorTabla {
  codigo_vendedor?: string;
  codVendedor?: string;
  id_vendedor?: number | string;
  idVendedor?: number | string;
  nombre?: string;
  proveedor?: string;
  nomProveedor?: string;
  nombreProveedor?: string;
  categoria?: string;
  nomCategoria?: string;
  nombreCategoria?: string;
  ciudad?: string;
  nomCiudad?: string;
  nombreCiudad?: string;
  linea?: string;
  nomLinea?: string;
  nombreLinea?: string;
  cuotaMes?: number;
  cuotaSemana?: number;
  cuotaDiaria?: number;
  ventaAcum?: number;
  porcCump?: number;
  proyeccionVenta?: number;
  nombreSupervisor?: string;
  id_supervisor?: number | string | null;
  idSupervisor?: number | string | null;
  supervisor?: { username?: string; nombre?: string } | null;
  estado?: boolean;
}

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
  @Input() campoCuota: keyof Pick<VendedorTabla, 'cuotaMes' | 'cuotaSemana' | 'cuotaDiaria'> = 'cuotaMes';
  @Input() cargandoVendedores = false;
  @Input() todosLosVendedores: VendedorTabla[] = [];

  @Output() asignarSupervisor = new EventEmitter<VendedorTabla>();

  montoCuota(vendedor: VendedorTabla): number {
    return Number(vendedor[this.campoCuota] ?? 0);
  }

  onAsignar(vendedor: VendedorTabla): void {
    this.asignarSupervisor.emit(vendedor);
  }
}
