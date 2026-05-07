import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FilterOption {
  label: string;
  value: string;
}

export interface DashboardFilters {
  fechaInicio: string;
  fechaFin: string;
  vendedor: string;

  proveedor: string;
  proveedorNombre?: string;

  categoria: string;
  categoriaNombre?: string;

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
export class FiltersComponent implements OnChanges {
  @Input() proveedores: FilterOption[] = [];
  @Input() categorias: FilterOption[] = [];
  @Input() ciudades: FilterOption[] = [];
  @Input() lineas: FilterOption[] = [];
  @Input() vendedores: FilterOption[] = [];

  @Output() apply = new EventEmitter<DashboardFilters>();

  isFiltrosOpen = false;

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    proveedorNombre: '',
    categoria: '',
    categoriaNombre: '',
    ciudad: '',
    ciudadNombre: '',
    linea: '',
  };

  /**
   * Esta lista es la que realmente pinta el select de ciudad.
   * La guardamos para que no desaparezcan las ciudades cuando el padre
   * vuelve a enviar [] o solo "Todas" después de aplicar proveedor/categoría.
   */
  ciudadesVista: FilterOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ciudades']) {
      this.actualizarCiudadesVista(this.ciudades);
    }
  }

  get esAdmin(): boolean {
    return this.vendedores.length > 0;
  }

  toggleFiltros(): void {
    this.isFiltrosOpen = !this.isFiltrosOpen;
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '').trim();
  }

  private esOpcionTodas(opcion: FilterOption): boolean {
    const value = this.normalizarTexto(opcion?.value);
    const label = this.normalizarTexto(opcion?.label).toLowerCase();

    return !value || label === 'todas' || label === 'todos';
  }

  private normalizarOpciones(opciones: FilterOption[]): FilterOption[] {
    const mapa = new Map<string, FilterOption>();

    for (const opcion of Array.isArray(opciones) ? opciones : []) {
      const label = this.normalizarTexto(opcion?.label);
      const value = this.normalizarTexto(opcion?.value);

      if (!label && !value) continue;

      const normalizada: FilterOption = {
        label: label || value,
        value: value || label,
      };

      if (this.esOpcionTodas(normalizada)) continue;

      const key = normalizada.value || normalizada.label;

      if (!mapa.has(key)) {
        mapa.set(key, normalizada);
      }
    }

    return Array.from(mapa.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'es', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }

  private actualizarCiudadesVista(ciudadesInput: FilterOption[]): void {
    const ciudadesNormalizadas = this.normalizarOpciones(ciudadesInput);

    /*
      Si el padre manda ciudades reales, actualizamos.
      Si el padre manda [] o solo "Todas", conservamos la lista anterior.
    */
    if (ciudadesNormalizadas.length > 0) {
      this.ciudadesVista = ciudadesNormalizadas;
      return;
    }

    if (!this.ciudadesVista.length) {
      this.ciudadesVista = [];
    }
  }

  private obtenerLabelSeleccionado(opciones: FilterOption[], value: string): string {
    const valueNormalizado = this.normalizarTexto(value);

    if (!valueNormalizado) {
      return '';
    }

    const opcion = opciones.find(
      (item: FilterOption) => this.normalizarTexto(item.value) === valueNormalizado,
    );

    const label = this.normalizarTexto(opcion?.label);

    if (!label) {
      return '';
    }

    const labelNormalizado = label.toLowerCase();

    if (labelNormalizado === 'todos' || labelNormalizado === 'todas') {
      return '';
    }

    return label;
  }

  aplicar(): void {
    this.isFiltrosOpen = false;

    setTimeout(() => {
      const proveedorNombre = this.obtenerLabelSeleccionado(
        this.proveedores,
        this.filtros.proveedor,
      );

      const categoriaNombre = this.obtenerLabelSeleccionado(
        this.categorias,
        this.filtros.categoria,
      );

      const ciudadNombre = this.obtenerLabelSeleccionado(this.ciudadesVista, this.filtros.ciudad);

      this.apply.emit({
        ...this.filtros,
        proveedorNombre,
        categoriaNombre,
        ciudadNombre,
      });
    }, 0);
  }

  limpiar(): void {
    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      vendedor: '',
      proveedor: '',
      proveedorNombre: '',
      categoria: '',
      categoriaNombre: '',
      ciudad: '',
      ciudadNombre: '',
      linea: '',
    };

    this.apply.emit({
      ...this.filtros,
    });
  }
}
