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
  proveedores?: string[];
  proveedorNombres?: string[];

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
  @Input() mostrarFiltroVendedor = true;

  @Output() apply = new EventEmitter<DashboardFilters>();
  @Output() proveedorChange = new EventEmitter<string>();
  @Output() vendedorChange = new EventEmitter<string>();

  isFiltrosOpen = false;
  mostrarCategoriaDropdown = false;
  mostrarProveedorDropdown = false;

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    proveedorNombre: '',
    proveedores: [],
    proveedorNombres: [],
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

    if (changes['proveedores']) {
      this.limpiarProveedoresSeleccionadosInexistentes();
    }

    if (changes['categorias']) {
      this.limpiarCategoriasSeleccionadasInexistentes();
    }
  }

  get esAdmin(): boolean {
    return this.vendedores.length > 0;
  }

  get proveedoresSeleccionados(): string[] {
    return Array.isArray(this.filtros.proveedores) ? this.filtros.proveedores : [];
  }

  get textoProveedoresSeleccionados(): string {
    const total = this.proveedoresSeleccionados.length;

    if (total === 0) {
      return 'Todos';
    }

    if (total === 1) {
      const proveedor = this.proveedores.find((p) => p.value === this.proveedoresSeleccionados[0]);
      return proveedor?.label ?? '1 seleccionado';
    }

    return `${total} seleccionado(s)`;
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
    this.cerrarProveedorDropdown();
  }

  toggleProveedorDropdown(): void {
    this.mostrarProveedorDropdown = !this.mostrarProveedorDropdown;
    this.cerrarCategoriaDropdown();
  }

  cerrarProveedorDropdown(): void {
    this.mostrarProveedorDropdown = false;
  }

  toggleCategoriaDropdown(): void {
    this.mostrarCategoriaDropdown = !this.mostrarCategoriaDropdown;
    this.cerrarProveedorDropdown();
  }

  cerrarCategoriaDropdown(): void {
    this.mostrarCategoriaDropdown = false;
  }

  onClickOtroFiltro(): void {
    this.cerrarCategoriaDropdown();
    this.cerrarProveedorDropdown();
  }

  toggleProveedorCheckbox(value: string): void {
    const valor = String(value ?? '').trim();
    if (!valor) return;

    const actuales = Array.isArray(this.filtros.proveedores)
      ? [...this.filtros.proveedores]
      : [];

    const existe = actuales.includes(valor);
    const seleccionados = existe
      ? actuales.filter((item) => item !== valor)
      : [...actuales, valor];

    this.filtros.proveedores = seleccionados;
    this.filtros.proveedor = seleccionados.join(',');
    this.filtros.proveedorNombre = '';
    this.filtros.proveedorNombres = [];

    // Al cambiar proveedor se limpian categorías anteriores para que el catálogo
    // se cargue nuevamente con las categorías disponibles de esos proveedores.
    this.limpiarCategoriasSeleccionadas();
    this.proveedorChange.emit(this.filtros.proveedor);
  }

  limpiarProveedoresSeleccionados(): void {
    this.filtros.proveedores = [];
    this.filtros.proveedor = '';
    this.filtros.proveedorNombre = '';
    this.filtros.proveedorNombres = [];
    this.limpiarCategoriasSeleccionadas();
    this.proveedorChange.emit('');
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

  private limpiarProveedoresSeleccionadosInexistentes(): void {
    const seleccionados = Array.isArray(this.filtros.proveedores)
      ? this.filtros.proveedores
      : [];

    if (!seleccionados.length) return;

    const valoresPermitidos = new Set(
      this.proveedores.map((item) => this.normalizarTexto(item.value)).filter(Boolean),
    );

    this.filtros.proveedores = seleccionados.filter((value) =>
      valoresPermitidos.has(this.normalizarTexto(value)),
    );
    this.filtros.proveedor = this.filtros.proveedores.join(',');
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

  aplicar(closeFilters = true): void {
    if (closeFilters) {
      this.isFiltrosOpen = false;
    }
    this.cerrarCategoriaDropdown();
    this.cerrarProveedorDropdown();

    setTimeout(() => {
      const proveedoresSeleccionados = Array.isArray(this.filtros.proveedores)
        ? this.filtros.proveedores.filter(Boolean)
        : String(this.filtros.proveedor ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

      const proveedorNombres = this.obtenerLabelsSeleccionados(
        this.proveedores,
        proveedoresSeleccionados,
      );

      const proveedorNombre =
        proveedorNombres.length === 1 ? proveedorNombres[0] : '';

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
        proveedor: proveedoresSeleccionados.join(','),
        proveedorNombre,
        proveedores: proveedoresSeleccionados,
        proveedorNombres,
        categoria: categoriasSeleccionadas.length === 1 ? categoriasSeleccionadas[0] : '',
        categoriaNombre: categoriaNombres.length === 1 ? categoriaNombres[0] : '',
        categorias: categoriasSeleccionadas,
        categoriaNombres,
        ciudadNombre,
      });
    }, 0);
  }

  onVendedorChange(value: string): void {
    this.filtros.vendedor = String(value ?? '').trim();
    // Emitir un evento directo para permitir al padre reaccionar inmediatamente
    this.vendedorChange.emit(this.filtros.vendedor);
    // Aplicar filtros sin cerrar el panel para que el usuario pueda seguir ajustando
    this.aplicar(false);
  }

  limpiar(): void {
    this.cerrarCategoriaDropdown();

    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      vendedor: '',
      proveedor: '',
      proveedorNombre: '',
      proveedores: [],
      proveedorNombres: [],
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
