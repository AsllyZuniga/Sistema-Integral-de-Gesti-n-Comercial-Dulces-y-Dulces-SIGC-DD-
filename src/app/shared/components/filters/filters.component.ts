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
  vendedores?: string[];

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
  ciudades?: string[];
  ciudadesNombres?: string[];

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
  @Input() filtrosActivos: DashboardFilters | null = null;

  @Output() apply = new EventEmitter<DashboardFilters>();
  @Output() proveedorChange = new EventEmitter<string>();
  @Output() vendedorChange = new EventEmitter<string>();
  /**
   * Se dispara cada vez que el usuario cambia cualquier filtro
   * (rango fechas, vendedor, proveedor, categoría, ciudad). Sirve
   * para que el padre re-pueble los 4 desplegables en cascada
   * llamando a /api/filtros/opciones. NO dispara actualización de
   * tablas (eso ocurre con `apply` al pulsar "Aplicar Filtros").
   */
  @Output() filterChange = new EventEmitter<DashboardFilters>();

  isFiltrosOpen = false;
  mostrarCategoriaDropdown = false;
  mostrarProveedorDropdown = false;
  mostrarVendedorDropdown = false;
  mostrarCiudadDropdown = false;

  filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    vendedores: [],
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
    ciudades: [],
    ciudadesNombres: [],
    linea: '',
  };

  ciudadesVista: FilterOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filtrosActivos'] && this.filtrosActivos) {
      this.sincronizarFiltrosActivos(this.filtrosActivos);
    }

    if (changes['ciudades']) {
      this.actualizarCiudadesVista(this.ciudades);
    }

    let seLimpioSeleccion = false;

    if (changes['proveedores']) {
      seLimpioSeleccion = this.limpiarProveedoresSeleccionadosInexistentes() || seLimpioSeleccion;
    }

    if (changes['categorias']) {
      seLimpioSeleccion = this.limpiarCategoriasSeleccionadasInexistentes() || seLimpioSeleccion;
    }

    if (changes['vendedores']) {
      seLimpioSeleccion = this.limpiarVendedoresSeleccionadosInexistentes() || seLimpioSeleccion;
    }

    if (seLimpioSeleccion) {
      this.emitFilterChange();
    }
  }

  private sincronizarFiltrosActivos(filtros: DashboardFilters): void {
    const normalizarArray = (arr: string[] | undefined | null, legacy: unknown): string[] => {
      const desdeArray = Array.isArray(arr)
        ? arr.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
      if (desdeArray.length) return desdeArray;
      return String(legacy ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    };

    this.filtros = {
      ...this.filtros,
      ...filtros,
      vendedores: normalizarArray(filtros.vendedores, filtros.vendedor),
      proveedor: String(filtros.proveedor ?? '').trim(),
      proveedores: normalizarArray(filtros.proveedores, filtros.proveedor),
      categorias: normalizarArray(filtros.categorias, filtros.categoria),
      ciudades: normalizarArray(filtros.ciudades, filtros.ciudad),
    };
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

  get vendedoresSeleccionados(): string[] {
    return Array.isArray(this.filtros.vendedores) ? this.filtros.vendedores : [];
  }

  get textoVendedoresSeleccionados(): string {
    const total = this.vendedoresSeleccionados.length;
    if (total === 0) return 'Todos';
    if (total === 1) {
      const v = this.vendedores.find((x) => x.value === this.vendedoresSeleccionados[0]);
      return v?.label ?? '1 seleccionado';
    }
    return `${total} seleccionado(s)`;
  }

  get ciudadesSeleccionadas(): string[] {
    return Array.isArray(this.filtros.ciudades) ? this.filtros.ciudades : [];
  }

  get textoCiudadesSeleccionadas(): string {
    const total = this.ciudadesSeleccionadas.length;
    if (total === 0) return 'Todas';
    if (total === 1) {
      const c = this.ciudadesVista.find((x) => x.value === this.ciudadesSeleccionadas[0]);
      return c?.label ?? '1 seleccionada';
    }
    return `${total} seleccionada(s)`;
  }

  toggleFiltros(): void {
    this.isFiltrosOpen = !this.isFiltrosOpen;
    this.cerrarTodosDropdowns();
  }

  toggleProveedorDropdown(): void {
    this.mostrarProveedorDropdown = !this.mostrarProveedorDropdown;
    this.mostrarCategoriaDropdown = false;
    this.mostrarVendedorDropdown = false;
    this.mostrarCiudadDropdown = false;
  }

  cerrarProveedorDropdown(): void {
    this.mostrarProveedorDropdown = false;
  }

  toggleCategoriaDropdown(): void {
    this.mostrarCategoriaDropdown = !this.mostrarCategoriaDropdown;
    this.mostrarProveedorDropdown = false;
    this.mostrarVendedorDropdown = false;
    this.mostrarCiudadDropdown = false;
  }

  cerrarCategoriaDropdown(): void {
    this.mostrarCategoriaDropdown = false;
  }

  toggleVendedorDropdown(): void {
    this.mostrarVendedorDropdown = !this.mostrarVendedorDropdown;
    this.mostrarProveedorDropdown = false;
    this.mostrarCategoriaDropdown = false;
    this.mostrarCiudadDropdown = false;
  }

  cerrarVendedorDropdown(): void {
    this.mostrarVendedorDropdown = false;
  }

  toggleCiudadDropdown(): void {
    this.mostrarCiudadDropdown = !this.mostrarCiudadDropdown;
    this.mostrarProveedorDropdown = false;
    this.mostrarCategoriaDropdown = false;
    this.mostrarVendedorDropdown = false;
  }

  cerrarCiudadDropdown(): void {
    this.mostrarCiudadDropdown = false;
  }

  cerrarTodosDropdowns(): void {
    this.mostrarProveedorDropdown = false;
    this.mostrarCategoriaDropdown = false;
    this.mostrarVendedorDropdown = false;
    this.mostrarCiudadDropdown = false;
  }

  onClickOtroFiltro(): void {
    this.cerrarTodosDropdowns();
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

    // No limpiamos categoría aquí. El backend devuelve categorías filtradas por
    // los otros filtros y el padre solo elimina las selecciones que ya no existan.
    this.proveedorChange.emit(this.filtros.proveedor);
    this.emitFilterChange();
  }

  limpiarProveedoresSeleccionados(): void {
    this.filtros.proveedores = [];
    this.filtros.proveedor = '';
    this.filtros.proveedorNombre = '';
    this.filtros.proveedorNombres = [];
    // Al limpiar proveedor se conservan las categorías seleccionadas si siguen
    // siendo válidas para fecha/vendedor/ciudad.
    this.proveedorChange.emit('');
    this.emitFilterChange();
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
    this.emitFilterChange();
  }

  limpiarCategoriasSeleccionadas(emitirCambio = true): void {
    this.filtros.categorias = [];
    this.filtros.categoria = '';
    this.filtros.categoriaNombre = '';
    this.filtros.categoriaNombres = [];

    if (emitirCambio) {
      this.emitFilterChange();
    }
  }

  toggleVendedorCheckbox(value: string): void {
    const valor = String(value ?? '').trim();
    if (!valor) return;

    const actuales = Array.isArray(this.filtros.vendedores)
      ? [...this.filtros.vendedores]
      : [];

    const existe = actuales.includes(valor);
    const seleccionados = existe
      ? actuales.filter((item) => item !== valor)
      : [...actuales, valor];

    this.filtros.vendedores = seleccionados;
    this.filtros.vendedor = seleccionados.length === 1 ? seleccionados[0] : '';
    this.vendedorChange.emit(this.filtros.vendedor);
    this.emitFilterChange();
  }

  limpiarVendedoresSeleccionados(): void {
    this.filtros.vendedores = [];
    this.filtros.vendedor = '';
    this.vendedorChange.emit('');
    this.emitFilterChange();
  }

  toggleCiudadCheckbox(value: string): void {
    const valor = String(value ?? '').trim();
    if (!valor) return;

    const actuales = Array.isArray(this.filtros.ciudades)
      ? [...this.filtros.ciudades]
      : [];

    const existe = actuales.includes(valor);
    const seleccionados = existe
      ? actuales.filter((item) => item !== valor)
      : [...actuales, valor];

    this.filtros.ciudades = seleccionados;
    this.filtros.ciudad = seleccionados.length === 1 ? seleccionados[0] : '';
    this.filtros.ciudadNombre = '';
    this.filtros.ciudadesNombres = [];
    this.emitFilterChange();
  }

  limpiarCiudadesSeleccionadas(): void {
    this.filtros.ciudades = [];
    this.filtros.ciudad = '';
    this.filtros.ciudadNombre = '';
    this.filtros.ciudadesNombres = [];
    this.emitFilterChange();
  }

  onFechaChange(): void {
    this.emitFilterChange();
  }

  private emitFilterChange(): void {
    setTimeout(() => this.filterChange.emit({ ...this.filtros }), 0);
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

  private limpiarProveedoresSeleccionadosInexistentes(): boolean {
    const seleccionados = Array.isArray(this.filtros.proveedores)
      ? this.filtros.proveedores
      : [];

    if (!seleccionados.length) return false;

    const valoresPermitidos = new Set(
      this.proveedores.map((item) => this.normalizarTexto(item.value)).filter(Boolean),
    );

    const filtrados = seleccionados.filter((value) =>
      valoresPermitidos.has(this.normalizarTexto(value)),
    );

    const cambio = filtrados.length !== seleccionados.length;
    this.filtros.proveedores = filtrados;
    this.filtros.proveedor = this.filtros.proveedores.join(',');

    return cambio;
  }

  private limpiarCategoriasSeleccionadasInexistentes(): boolean {
    const categoriasSeleccionadas = Array.isArray(this.filtros.categorias)
      ? this.filtros.categorias
      : [];

    if (!categoriasSeleccionadas.length) return false;

    const valoresPermitidos = new Set(
      this.categorias.map((item) => this.normalizarTexto(item.value)).filter(Boolean),
    );

    const filtradas = categoriasSeleccionadas.filter((value) =>
      valoresPermitidos.has(this.normalizarTexto(value)),
    );

    const cambio = filtradas.length !== categoriasSeleccionadas.length;
    this.filtros.categorias = filtradas;
    this.filtros.categoria =
      this.filtros.categorias.length === 1 ? this.filtros.categorias[0] : '';

    return cambio;
  }

  private limpiarVendedoresSeleccionadosInexistentes(): boolean {
    const seleccionados = Array.isArray(this.filtros.vendedores)
      ? this.filtros.vendedores
      : [];

    if (!seleccionados.length) return false;

    const valoresPermitidos = new Set(
      this.vendedores.map((item) => this.normalizarTexto(item.value)).filter(Boolean),
    );

    const filtrados = seleccionados.filter((value) =>
      valoresPermitidos.has(this.normalizarTexto(value)),
    );

    const cambio = filtrados.length !== seleccionados.length;
    this.filtros.vendedores = filtrados;
    this.filtros.vendedor = this.filtros.vendedores.length === 1 ? this.filtros.vendedores[0] : '';

    return cambio;
  }

  aplicar(closeFilters = true): void {
    if (closeFilters) {
      this.isFiltrosOpen = false;
    }
    this.cerrarTodosDropdowns();

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

      const vendedoresSeleccionados = Array.isArray(this.filtros.vendedores)
        ? this.filtros.vendedores.filter(Boolean)
        : String(this.filtros.vendedor ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

      const ciudadesSeleccionadas = Array.isArray(this.filtros.ciudades)
        ? this.filtros.ciudades.filter(Boolean)
        : String(this.filtros.ciudad ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

      const ciudadesNombres = this.obtenerLabelsSeleccionados(
        this.ciudadesVista,
        ciudadesSeleccionadas,
      );

      const ciudadNombre = ciudadesNombres.length === 1 ? ciudadesNombres[0] : '';

      this.apply.emit({
        ...this.filtros,
        vendedor: vendedoresSeleccionados.join(','),
        vendedores: vendedoresSeleccionados,
        proveedor: proveedoresSeleccionados.join(','),
        proveedorNombre,
        proveedores: proveedoresSeleccionados,
        proveedorNombres,
        categoria: categoriasSeleccionadas.length === 1 ? categoriasSeleccionadas[0] : '',
        categoriaNombre: categoriaNombres.length === 1 ? categoriaNombres[0] : '',
        categorias: categoriasSeleccionadas,
        categoriaNombres,
        ciudad: ciudadesSeleccionadas.length === 1 ? ciudadesSeleccionadas[0] : '',
        ciudadNombre,
        ciudades: ciudadesSeleccionadas,
        ciudadesNombres,
      });
    }, 0);
  }

  onVendedorChange(value: string): void {
    this.filtros.vendedor = String(value ?? '').trim();
    this.vendedorChange.emit(this.filtros.vendedor);
    this.aplicar(false);
  }

  limpiar(): void {
    this.cerrarTodosDropdowns();

    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      vendedor: '',
      vendedores: [],
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
      ciudades: [],
      ciudadesNombres: [],
      linea: '',
    };

    this.proveedorChange.emit('');

    this.apply.emit({
      ...this.filtros,
    });

    this.emitFilterChange();
  }
}
