import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
  vendedor: string;
  proveedor: string;
  categoria: string;
  ciudad: string;
  ciudadNombre?: string;
  linea?: string;
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
  @Input() categorias: string[] = [];
  @Input() ciudades: string[] = [];
  @Input() lineas: string[] = [];
  @Input() vendedores: string[] = [];

  @Output() apply = new EventEmitter<DashboardFilters>();

  isFiltrosOpen = false;

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    linea: '',
    ciudadNombre: '',
  };

  get esAdmin(): boolean {
    return this.vendedores.length > 0;
  }

  toggleFiltros(): void {
    this.isFiltrosOpen = !this.isFiltrosOpen;
  }

  aplicar(): void {
    this.isFiltrosOpen = false;
    this.apply.emit({ ...this.filtros, ciudadNombre: this.filtros.ciudad || '' });
  }

  limpiar(): void {
    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      vendedor: '',
      proveedor: '',
      categoria: '',
      ciudad: '',
      linea: '',
      ciudadNombre: '',
    };
    this.apply.emit({ ...this.filtros });
  }
}