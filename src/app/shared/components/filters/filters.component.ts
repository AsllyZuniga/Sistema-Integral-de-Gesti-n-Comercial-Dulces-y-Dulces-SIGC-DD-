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
  categorias?: string[];
  categoriaNombres?: string[];

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
  @Output() proveedorChange = new EventEmitter<string>();

  isFiltrosOpen = false;
  mostrarCategoriaDropdown = false;

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    proveedorNombre: '',
    categoria: '',
    categoriaNombre: '',
    categorias: [],
    categoriaNombres: [],
    ciudad: '',
    ciudadNombre: '',
    linea: '',
  };

  ciudadesVista: FilterOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ciudades']) {
      this.actualizarCiudadesVista(this.ciudades);
    }

    if (changes['categorias']) {
      this.limpiarCategoriasSeleccionadasInexistentes();
    }
  }

  get esAdmin(): boolean {
    return this.vendedores.length > 0;
  }

  get categoriasSeleccionadas(): string[] {
    return Array.isArray(this.filtros.categorias) ? this.filtros.categorias : [];
  }

  get textoCategoriasSeleccionadas(): string {
    const total = this.categoriasSeleccionadas.length;

    if (total === 0) {
      return 'Todas';
    }

    if (total === 1) {
      const categoria = this.categorias.find((c) => c.value === this.categoriasSeleccionadas[0]);
      return categoria?.label ?? '1 seleccionada';
    }

    return `${total} seleccionada(s)`;
  }

  toggleFiltros(): void {
    this.isFiltrosOpen = !this.isFiltrosOpen;
    this.cerrarCategoriaDropdown();
  }

  toggleCategoriaDropdown(): void {
    this.mostrarCategoriaDropdown = !this.mostrarCategoriaDropdown;
  }

  cerrarCategoriaDropdown(): void {
    this.mostrarCategoriaDropdown = false;
  }

  onClickOtroFiltro(): void {
    this.cerrarCategoriaDropdown();
  }

  onProveedorChange(value: string): void {
    const proveedor = String(value ?? '').trim();

    this.filtros.proveedor = proveedor;

    // Al cambiar proveedor se limpian categorías seleccionadas anteriores.
    this.limpiarCategoriasSeleccionadas();

    // Notifica al Dashboard para cargar categorías del proveedor sin aplicar filtros.
    this.proveedorChange.emit(proveedor);
  }

  toggleCategoriaCheckbox(value: string): void {
    const valor = String(value ?? '').trim();
    if (!valor) return;

    const actuales = Array.isArray(this.filtros.categorias)
      ? [...this.filtros.categorias]
      : [];

    const existe = actuales.includes(valor);

    this.filtros.categorias = existe
      ? actuales.filter((item) => item !== valor)
      : [...actuales, valor];

    this.filtros.categoria =
      this.filtros.categorias.length === 1 ? this.filtros.categorias[0] : '';

    this.filtros.categoriaNombre = '';
    this.filtros.categoriaNombres = [];
  }

  limpiarCategoriasSeleccionadas(): void {
    this.filtros.categorias = [];
    this.filtros.categoria = '';
    this.filtros.categoriaNombre = '';
    this.filtros.categoriaNombres = [];
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

  private obtenerLabelsSeleccionados(opciones: FilterOption[], values: string[]): string[] {
    return values
      .map((value) => this.obtenerLabelSeleccionado(opciones, value))
      .filter(Boolean);
  }

  private limpiarCategoriasSeleccionadasInexistentes(): void {
    const categoriasSeleccionadas = Array.isArray(this.filtros.categorias)
      ? this.filtros.categorias
      : [];

    if (!categoriasSeleccionadas.length) return;

    const valoresPermitidos = new Set(
      this.categorias.map((item) => this.normalizarTexto(item.value)).filter(Boolean),
    );

    this.filtros.categorias = categoriasSeleccionadas.filter((value) =>
      valoresPermitidos.has(this.normalizarTexto(value)),
    );

    this.filtros.categoria =
      this.filtros.categorias.length === 1 ? this.filtros.categorias[0] : '';
  }

  aplicar(): void {
    this.isFiltrosOpen = false;
    this.cerrarCategoriaDropdown();

    setTimeout(() => {
      const proveedorNombre = this.obtenerLabelSeleccionado(
        this.proveedores,
        this.filtros.proveedor,
      );

      const categoriasSeleccionadas = Array.isArray(this.filtros.categorias)
        ? this.filtros.categorias.filter(Boolean)
        : [];

      const categoriaNombres = this.obtenerLabelsSeleccionados(
        this.categorias,
        categoriasSeleccionadas,
      );

      const ciudadNombre = this.obtenerLabelSeleccionado(this.ciudadesVista, this.filtros.ciudad);

      this.apply.emit({
        ...this.filtros,
        proveedorNombre,
        categoria: categoriasSeleccionadas.length === 1 ? categoriasSeleccionadas[0] : '',
        categoriaNombre: categoriaNombres.length === 1 ? categoriaNombres[0] : '',
        categorias: categoriasSeleccionadas,
        categoriaNombres,
        ciudadNombre,
      });
    }, 0);
  }

  limpiar(): void {
    this.cerrarCategoriaDropdown();

    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      vendedor: '',
      proveedor: '',
      proveedorNombre: '',
      categoria: '',
      categoriaNombre: '',
      categorias: [],
      categoriaNombres: [],
      ciudad: '',
      ciudadNombre: '',
      linea: '',
    };

    this.proveedorChange.emit('');

    this.apply.emit({
      ...this.filtros,
    });
  }
}
