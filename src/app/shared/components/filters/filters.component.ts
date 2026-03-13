import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
  vendedor: string;
  proveedor: string;
  ciudad: string;
}

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filters.component.html',
  styleUrls: ['./filters.component.css'],
})
export class FiltersComponent {
  @Input() proveedores: string[] = [];
  @Input() ciudades: string[] = [];

  @Output() apply = new EventEmitter<DashboardFilters>();

  isFiltrosOpen = false;

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    ciudad: '',
  };

  toggleFiltros() { this.isFiltrosOpen = !this.isFiltrosOpen; }

  aplicar() {
    this.isFiltrosOpen = false;
    this.apply.emit({ ...this.filtros });
  }

  limpiar() {
    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      vendedor: '',
      proveedor: '',
      ciudad: '',
    };
    this.apply.emit({ ...this.filtros });
  }
}