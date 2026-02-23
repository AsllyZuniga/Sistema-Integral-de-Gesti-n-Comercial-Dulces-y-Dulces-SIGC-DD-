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
}

@Component({
  selector: 'app-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filters.component.html',
  styleUrls: ['./filters.component.css']
})
export class FiltersComponent {

  // 🔥 Datos vienen del backend (desde el padre)
  @Input() vendedores: string[] = [];
  @Input() proveedores: string[] = [];
  @Input() categorias: string[] = [];
  @Input() ciudades: string[] = [];

  @Output() apply = new EventEmitter<DashboardFilters>();

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: ''
  };

  aplicar() {
    this.apply.emit(this.filtros);
  }
}