import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { CardComponent } from '../../../../shared/components/card/card.component';
import {
  DashboardFilters,
} from '../../../../shared/components/filters/filters.component';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { ProveedorService } from '../../../../core/services/proveedor.service';
import { TipoCuota } from '../../../cumplimientos-cuota/cumplimientos.component';
import { VentasComponent } from '../../components/ventas/ventas.component';
import {
  VendedorTabla,
} from '../shared/vendedores-table/vendedores-table.component';

interface SupervisorResumen {
  id_usuario?: number | string;
  idUsuario?: number | string;
  id?: number | string;
  username?: string;
  nombre?: string;
}

interface CuotaDetalle {
  cuota_mes?: number;
  cuota_semana?: number;
  cuota_dia?: number;
}

interface VendedorApiRow {
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
  cuotaMes?: number | CuotaDetalle;
  cuotaSemana?: number | CuotaDetalle;
  cuotaDiaria?: number | CuotaDetalle;
  ventaAcum?: number;
  porcCump?: number;
  proyeccionVenta?: number;
  nombreSupervisor?: string;
  id_supervisor?: number | string | null;
  idSupervisor?: number | string | null;
  supervisor?: { username?: string; nombre?: string } | null;
}

@Component({
  selector: 'app-administrador-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, VentasComponent],
  templateUrl: './administrador.component.html',
  styleUrls: ['./administrador.component.css'],
})
export class AdministradorComponent implements OnInit, OnChanges, OnDestroy {
  private cumplimientoService = inject(CumplimientoService);
  private semanaService = inject(CumplimientoSemanaService);
  private usuariosService = inject(UsuariosService);
  private cdr = inject(ChangeDetectorRef);
  private proveedorService = inject(ProveedorService);

  @Input() tipoCuota: TipoCuota = 'mensual';
  @Input() filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    linea: '',
  };

  // Usa esta copia en el HTML para <app-ventas>.
  // Siempre se reemplaza por una NUEVA referencia para que el @Input() set filtros
  // de VentasComponent se dispare al cambiar proveedor/categoria/ciudad/fechas.
  filtrosAnalisis: DashboardFilters = { ...this.filtrosActivos };

  totales: { ventaAcum: number; cuotaMes: number; porcCump: number; proyeccionVenta: number } | null = null;
  cargandoVendedores = false;
  catalogoVendedores: VendedorTabla[] = [];
  todosLosVendedores: VendedorTabla[] = [];

  supervisoresList: SupervisorResumen[] = [];
  modalAsignarVisible = false;
  vendedorEnModal: VendedorTabla | null = null;
  supervisorSeleccionado = '';
  asignandoSupervisor = false;

  private supervisorPorCodigoVendedor: Map<string, string> = new Map();
  private codigoVendedorAIdMap: Map<string, string | number> = new Map();
  private destroy$ = new Subject<void>();
  private initialized = false;
  private proveedoresList: any[] = [];
  private proveedoresMap: Map<string, string> = new Map();

  private obtenerCodigoVendedor(vendedor: Pick<VendedorTabla, 'codVendedor' | 'codigo_vendedor'> | VendedorApiRow): string {
    return String(vendedor.codVendedor ?? vendedor.codigo_vendedor ?? '').trim();
  }

  private generarClavesCodigo(codigoRaw: unknown): string[] {
    const codigo = String(codigoRaw ?? '').trim();
    if (!codigo) return [];

    const claves = new Set<string>();
    claves.add(codigo);

    const numerico = codigo.replace(/\D/g, '');
    if (numerico) {
      claves.add(numerico);
      claves.add(String(Number(numerico)));
      claves.add(numerico.padStart(4, '0'));
      // also add without leading zeros
      claves.add(numerico.replace(/^0+/, '') || numerico);
    }

    return Array.from(claves).filter(Boolean);
  }

  private obtenerNombreSupervisor(
    vendedor: VendedorApiRow | VendedorTabla,
    supervisor?: SupervisorResumen,
  ): string {
    return (
      vendedor.supervisor?.username ??
      vendedor.supervisor?.nombre ??
      supervisor?.username ??
      supervisor?.nombre ??
      vendedor.nombreSupervisor ??
      ''
    );
  }

  private leerCuota(valor: number | CuotaDetalle | null | undefined, clave: keyof CuotaDetalle): number {
    if (typeof valor === 'number') {
      return valor;
    }

    if (valor && typeof valor === 'object') {
      return Number(valor[clave] ?? 0);
    }

    return Number(valor ?? 0);
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9\s.,-]/g, '');
  }

  private obtenerValoresProveedorFiltro(valor: unknown): string[] {
    const raw = String(valor ?? '').trim();
    if (!raw) return [];

    const normalizado = this.normalizarTexto(raw);
    const valores = new Set<string>([normalizado]);
    const codigoMapeado = this.proveedoresMap.get(normalizado);

    if (codigoMapeado) {
      valores.add(this.normalizarTexto(codigoMapeado));
    }

    this.proveedoresList.forEach((p) => {
      const codigo = String(p?.codigo ?? p?.id_proveedor ?? p?.codigoProveedor ?? '').trim();
      const nombre = String(p?.nombre ?? p?.nomProveedor ?? p?.nombreProveedor ?? '').trim();
      const codigoNorm = this.normalizarTexto(codigo);
      const nombreNorm = this.normalizarTexto(nombre);

      if (
        codigoNorm === normalizado ||
        nombreNorm === normalizado ||
        (codigoMapeado && codigoNorm === this.normalizarTexto(codigoMapeado))
      ) {
        if (codigoNorm) valores.add(codigoNorm);
        if (nombreNorm) valores.add(nombreNorm);
      }
    });

    return Array.from(valores).filter(Boolean);
  }

  private obtenerValoresVendedorFiltro(valor: unknown): string[] {
    const raw = String(valor ?? '').trim();
    if (!raw) return [];

    const normalizado = this.normalizarTexto(raw);
    const valores = new Set<string>([normalizado]);

    const matchCodigo = raw.match(/^(\d+)/);
    if (matchCodigo?.[1]) {
      valores.add(this.normalizarTexto(matchCodigo[1]));
    }

    const matchEtiqueta = raw.match(/^\s*(\d+)\s*[-–]\s*(.+)$/);
    if (matchEtiqueta?.[1]) {
      valores.add(this.normalizarTexto(matchEtiqueta[1]));
      valores.add(this.normalizarTexto(matchEtiqueta[2]));
    }

    return Array.from(valores).filter(Boolean);
  }

  private aplicarFiltrosAdministrador(lista: VendedorTabla[]): VendedorTabla[] {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);

    const vendedorFiltro = this.obtenerValoresVendedorFiltro(filtros.vendedor);
    const proveedoresFiltro = this.obtenerValoresProveedorFiltro(filtros.proveedor);
    const categoriaFiltro = this.normalizarTexto(filtros.categoria);
    const ciudadFiltro = this.normalizarTexto(filtros.ciudadNombre ?? filtros.ciudad ?? '');
    const lineaFiltro = this.normalizarTexto(filtros.linea);

    return lista.filter((v) => {
      if (vendedorFiltro.length) {
        const vendedorValoresFila = [
          v.codVendedor,
          v.codigo_vendedor,
          v.nombre,
          (v as any).codigoVendedor,
          (v as any).codigo_vendedor,
        ]
          .map((valor) => this.normalizarTexto(valor))
          .filter(Boolean);

        const coincideVendedor = vendedorValoresFila.some((valorFila) =>
          vendedorFiltro.some((valorFiltro) => valorFila === valorFiltro || valorFila.includes(valorFiltro)),
        );

        if (!coincideVendedor) return false;
      }

      // IMPORTANTE:
      // Los filtros proveedor/categoria/ciudad/linea ya se envían al backend.
      // Si el endpoint devuelve filas resumidas por vendedor, muchas veces NO trae esos campos.
      // Antes se filtraba localmente contra campos vacíos y por eso la tabla quedaba vacía.
      // Ahora solo aplicamos el filtro local cuando la fila sí trae valores para comparar.
      if (proveedoresFiltro.length) {
        const proveedorValoresFila = [
          v.proveedor,
          v.nomProveedor,
          v.nombreProveedor,
          (v as any).codigoProveedor,
          (v as any).codigo_proveedor,
          (v as any).id_proveedor,
        ]
          .map((valor) => this.normalizarTexto(valor))
          .filter(Boolean);

        if (proveedorValoresFila.length) {
          const coincideProveedor = proveedorValoresFila.some((valorFila) =>
            proveedoresFiltro.some(
              (valorFiltro) => valorFila === valorFiltro || valorFila.includes(valorFiltro),
            ),
          );

          if (!coincideProveedor) return false;
        }
      }

      if (categoriaFiltro) {
        const categoriaValoresFila = [v.categoria, v.nomCategoria, v.nombreCategoria]
          .map((valor) => this.normalizarTexto(valor))
          .filter(Boolean);

        if (
          categoriaValoresFila.length &&
          !categoriaValoresFila.some((valorFila) => valorFila.includes(categoriaFiltro))
        ) {
          return false;
        }
      }

      if (ciudadFiltro) {
        const ciudadValoresFila = [v.ciudad, v.nomCiudad, v.nombreCiudad]
          .map((valor) => this.normalizarTexto(valor))
          .filter(Boolean);

        if (
          ciudadValoresFila.length &&
          !ciudadValoresFila.some((valorFila) => valorFila === ciudadFiltro)
        ) {
          return false;
        }
      }

      if (lineaFiltro) {
        const lineaValoresFila = [v.linea, v.nomLinea, v.nombreLinea]
          .map((valor) => this.normalizarTexto(valor))
          .filter(Boolean);

        if (
          lineaValoresFila.length &&
          !lineaValoresFila.some((valorFila) => valorFila.includes(lineaFiltro))
        ) {
          return false;
        }
      }

      return true;
    });
  }

  get labelCuota(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'Cuota Semana';
      case 'diaria':
        return 'Cuota Diaria';
      default:
        return 'Cuota Mes';
    }
  }

  get labelVentaAcum(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'Venta Semana';
      case 'diaria':
        return 'Venta Diaria';
      default:
        return 'Venta Mes';
    }
  }

  get campoCuota(): keyof Pick<VendedorTabla, 'cuotaMes' | 'cuotaSemana' | 'cuotaDiaria'> {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'cuotaSemana';
      case 'diaria':
        return 'cuotaDiaria';
      default:
        return 'cuotaMes';
    }
  }

  get codigoVendedorAnalisis(): string {
    const codigo = String(this.filtrosActivos?.vendedor ?? '').trim();
    return codigo || 'ALL';
  }

  ngOnInit(): void {
    this.initialized = true;
    this.cargarVendedoresDetalle();
    this.cargarProveedores();
    this.cargarSupervisores();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['tipoCuota'] || changes['filtrosActivos']) {
      this.actualizarFiltrosAnalisis();
      this.cargarTotales();
    }
  }

  private cargarProveedores(): void {
    this.proveedorService
      .getAllProveedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          this.proveedoresList = Array.isArray(res) ? res : [];
          this.proveedoresMap.clear();

          this.proveedoresList.forEach((p) => {
            const codigo = String(p?.codigo ?? (p as any)?.id_proveedor ?? '').trim();
            const nombre = this.normalizarTexto(p?.nombre ?? '');

            if (codigo) {
              // map by codigo (normalized) to codigo
              this.proveedoresMap.set(this.normalizarTexto(codigo), codigo);
            }

            if (nombre && codigo) {
              // map by normalized name to codigo
              this.proveedoresMap.set(nombre, codigo);
            }
          });

          console.debug('Proveedor map cargado (nombre->codigo):', this.proveedoresMap.size);

          this.actualizarFiltrosAnalisis();

          if (this.initialized && String(this.filtrosActivos?.proveedor ?? '').trim()) {
            this.cargarTotales();
          }
        },
        error: (err: any) => {
          console.error('Error cargando proveedores en Administrador:', err);
        },
      });
  }

  private actualizarFiltrosAnalisis(): void {
    this.filtrosAnalisis = this.obtenerFiltrosParaApi();
  }

  private obtenerFiltrosParaApi(): DashboardFilters {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);
    const provRaw = String(filtros.proveedor ?? '').trim();

    if (!provRaw) {
      return { ...filtros };
    }

    const codigoProveedor = this.proveedoresMap.get(this.normalizarTexto(provRaw)) ?? provRaw;

    return {
      ...filtros,
      proveedor: codigoProveedor,
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarVendedoresDetalle(): void {
    this.usuariosService
      .listarDetalleVendedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          this.codigoVendedorAIdMap.clear();
          const vendedores = Array.isArray(res) ? res : [];
          const catalogo: VendedorTabla[] = [];
          
          vendedores.forEach((vendedor: any) => {
            const codigo = String(
              vendedor.codigo_vendedor ??
              vendedor.codVendedor ??
              vendedor.codigo ??
              ''
            ).trim();
            const nombre = String(vendedor.nombre ?? vendedor.nom_vendedor ?? '').trim();
            
            const idVendedor = vendedor.id_vendedor ?? 
                               vendedor.idVendedor ?? 
                               vendedor.id_usuario ?? 
                               vendedor.idUsuario ?? 
                               vendedor.id;
            
            if (codigo && idVendedor) {
              this.codigoVendedorAIdMap.set(codigo, idVendedor);
            }

            if (codigo) {
              catalogo.push({
                codigo_vendedor: codigo,
                codVendedor: codigo,
                id_vendedor: idVendedor,
                idVendedor: idVendedor,
                nombre,
                proveedor: '',
                categoria: '',
                ciudad: '',
                linea: '',
                cuotaMes: 0,
                cuotaSemana: 0,
                cuotaDiaria: 0,
                ventaAcum: 0,
                porcCump: 0,
                proyeccionVenta: 0,
                nombreSupervisor: 'Sin asignar',
                id_supervisor: vendedor.id_supervisor ?? vendedor.idSupervisor ?? null,
                supervisor: vendedor.supervisor ?? null,
              });
            }
          });

          catalogo.sort((a, b) => {
            const nombreA = String(a.nombre ?? '').trim();
            const nombreB = String(b.nombre ?? '').trim();
            const porNombre = nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });

            if (porNombre !== 0) {
              return porNombre;
            }

            return String(a.codVendedor ?? '').localeCompare(String(b.codVendedor ?? ''), 'es', {
              sensitivity: 'base',
            });
          });

          this.catalogoVendedores = [...catalogo];
          this.todosLosVendedores = [...catalogo];
          
          console.log('✅ Mapa de vendedores cargado:', this.codigoVendedorAIdMap.size, 'vendedores');

          // Si los totales llegaron antes que el catálogo, recargamos para unir
          // correctamente vendedor + cuota + venta y actualizar la tabla.
          if (this.initialized) {
            this.cargarTotales();
          }
        },
        error: (err: any) => {
          console.error('❌ Error cargando vendedores:', err);
        },
      });
  }

  private cargarSupervisores(): void {
    this.usuariosService
      .listarSupervisores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: SupervisorResumen[]) => {
          this.supervisoresList = Array.isArray(res) ? res : [];
          this.recargarSupervisoresPorVendedorAdmin();
          this.cargarTotales();
        },
        error: () => {
          this.supervisoresList = [];
          this.cargarTotales();
        },
      });
  }

  private recargarSupervisoresPorVendedorAdmin(): void {
    if (this.supervisoresList.length === 0) {
      this.supervisorPorCodigoVendedor.clear();
      return;
    }

    const mapaTemporal = new Map<string, string>();
    let pendientes = this.supervisoresList.length;

    const finalizar = () => {
      pendientes -= 1;
      if (pendientes === 0) {
        this.supervisorPorCodigoVendedor = mapaTemporal;
        this.aplicarNombresSupervisorEnTabla();
        this.cdr.detectChanges();
      }
    };

    this.supervisoresList.forEach((supervisor) => {
      const idSupervisor = String(
        supervisor?.id_usuario ?? supervisor?.idUsuario ?? supervisor?.id ?? '',
      );

      if (!idSupervisor) {
        finalizar();
        return;
      }

      this.usuariosService
        .obtenerVendedoresDelSupervisor(idSupervisor)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (vendedores: VendedorApiRow[]) => {
            vendedores.forEach((v) => {
              const codigo = this.obtenerCodigoVendedor(v);
              const nombreSupervisor = this.obtenerNombreSupervisor(v, supervisor);

              if (codigo && nombreSupervisor) {
                // map multiple variants of the code to improve matching
                const claves = this.generarClavesCodigo(codigo);
                claves.forEach((clave) => mapaTemporal.set(clave, nombreSupervisor));
              }
            });
          },
          error: () => finalizar(),
          complete: () => finalizar(),
        });
    });
  }

  private cargarTotales(): void {
    const filtros = this.obtenerFiltrosParaApi();
    this.filtrosAnalisis = { ...filtros };
    const obs$ =
      this.tipoCuota === 'semanal'
        ? this.semanaService.getCumplimientoSemanaAdmin(filtros)
        : this.cumplimientoService.getCumplimientoMesAdmin(filtros);

    this.cargarDesdeEndpointAdmin(obs$, this.campoCuota);
  }

  private cargarDesdeEndpointAdmin(
    obs$: Observable<{ detalle?: VendedorApiRow[] }>,
    campoCuota: keyof Pick<VendedorTabla, 'cuotaMes' | 'cuotaSemana' | 'cuotaDiaria'>,
  ): void {
    this.cargandoVendedores = true;

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const detalle = (res?.detalle ?? []).filter((v) => this.obtenerCodigoVendedor(v) !== 'TOTALES');
        const detallePorCodigo = new Map<string, VendedorApiRow>();

        detalle.forEach((v) => {
          const codigo = this.obtenerCodigoVendedor(v);
          if (codigo) {
            detallePorCodigo.set(codigo, v);
          }
        });

        const baseCatalogo = this.catalogoVendedores.length > 0
          ? this.catalogoVendedores
          : detalle.map((fila) => ({
              codigo_vendedor: this.obtenerCodigoVendedor(fila),
              codVendedor: this.obtenerCodigoVendedor(fila),
              id_vendedor: fila.id_vendedor ?? fila.idVendedor,
              idVendedor: fila.id_vendedor ?? fila.idVendedor,
              nombre: fila.nombre ?? '',
              proveedor: fila.proveedor,
              nomProveedor: fila.nomProveedor,
              nombreProveedor: fila.nombreProveedor,
              categoria: fila.categoria,
              nomCategoria: fila.nomCategoria,
              nombreCategoria: fila.nombreCategoria,
              ciudad: fila.ciudad,
              nomCiudad: fila.nomCiudad,
              nombreCiudad: fila.nombreCiudad,
              linea: fila.linea,
              nomLinea: fila.nomLinea,
              nombreLinea: fila.nombreLinea,
              nombreSupervisor: fila.nombreSupervisor ?? '',
              id_supervisor: fila.id_supervisor ?? fila.idSupervisor ?? null,
              supervisor: fila.supervisor ?? null,
            } as VendedorTabla));

        const listaNormalizada: VendedorTabla[] = baseCatalogo.map((base) => {
          const codigo = String(base.codVendedor ?? base.codigo_vendedor ?? '').trim();
          const fila = detallePorCodigo.get(codigo);

          return {
            ...base,
            codigo_vendedor: base.codigo_vendedor ?? base.codVendedor,
            codVendedor: codigo,
            id_vendedor: base.id_vendedor ?? base.idVendedor,
            idVendedor: base.id_vendedor ?? base.idVendedor,
            nombre: fila?.nombre ?? base.nombre ?? '',
            proveedor: fila?.proveedor ?? base.proveedor,
            nomProveedor: fila?.nomProveedor ?? base.nomProveedor,
            nombreProveedor: fila?.nombreProveedor ?? base.nombreProveedor,
            categoria: fila?.categoria ?? base.categoria,
            nomCategoria: fila?.nomCategoria ?? base.nomCategoria,
            nombreCategoria: fila?.nombreCategoria ?? base.nombreCategoria,
            ciudad: fila?.ciudad ?? base.ciudad,
            nomCiudad: fila?.nomCiudad ?? base.nomCiudad,
            nombreCiudad: fila?.nombreCiudad ?? base.nombreCiudad,
            linea: fila?.linea ?? base.linea,
            nomLinea: fila?.nomLinea ?? base.nomLinea,
            nombreLinea: fila?.nombreLinea ?? base.nombreLinea,
            cuotaMes: this.leerCuota(fila?.cuotaMes ?? 0, 'cuota_mes'),
            cuotaSemana: this.leerCuota(fila?.cuotaSemana ?? 0, 'cuota_semana'),
            cuotaDiaria: this.leerCuota(fila?.cuotaDiaria ?? 0, 'cuota_dia'),
            ventaAcum: Number(fila?.ventaAcum ?? 0),
            porcCump: Number(fila?.porcCump ?? 0),
            proyeccionVenta: Number(fila?.proyeccionVenta ?? 0),
            nombreSupervisor: this.obtenerNombreSupervisor(fila ?? base),
            id_supervisor: fila?.id_supervisor ?? fila?.idSupervisor ?? base.id_supervisor ?? base.idSupervisor ?? null,
            supervisor: fila?.supervisor ?? base.supervisor ?? null,
          };
        });

        const hayFiltrosDeConsulta = !!String(
          this.filtrosActivos?.proveedor ||
            this.filtrosActivos?.categoria ||
            this.filtrosActivos?.ciudad ||
            this.filtrosActivos?.ciudadNombre ||
            this.filtrosActivos?.linea ||
            this.filtrosActivos?.vendedor ||
            '',
        ).trim();

        const listaBase = hayFiltrosDeConsulta
          ? listaNormalizada.filter((v) => detallePorCodigo.has(String(v.codVendedor ?? v.codigo_vendedor ?? '').trim()))
          : listaNormalizada;

        const listaFiltrada = this.aplicarFiltrosAdministrador(listaBase);
        this.todosLosVendedores = listaFiltrada;
        this.aplicarNombresSupervisorEnTabla();

        const ventaAcum = this.todosLosVendedores.reduce((s: number, v) => s + (Number(v.ventaAcum) || 0), 0);
        const cuota = this.todosLosVendedores.reduce((s: number, v) => s + (Number(v[campoCuota]) || 0), 0);
        const proyeccionVenta = this.todosLosVendedores.reduce(
          (s: number, v) => s + (Number(v.proyeccionVenta) || 0),
          0,
        );
        const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

        this.totales = { ventaAcum, cuotaMes: cuota, porcCump, proyeccionVenta };
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.totales = null;
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
    });
  }

  private aplicarNombresSupervisorEnTabla(): void {
    if (!this.todosLosVendedores.length) return;

    this.todosLosVendedores = this.todosLosVendedores.map((v) => {
      const codigo = this.obtenerCodigoVendedor(v);
      let nombreSupervisor = '';

      // Try multiple key variants when looking up supervisor name
      const claves = this.generarClavesCodigo(codigo);
      for (const clave of claves) {
        const encontrado = this.supervisorPorCodigoVendedor.get(clave);
        if (encontrado) {
          nombreSupervisor = encontrado;
          break;
        }
      }

      nombreSupervisor =
        nombreSupervisor || v.supervisor?.username || v.supervisor?.nombre || v?.nombreSupervisor || '';

      return { ...v, nombreSupervisor };
    });
  }

  abrirModalAsignar(vendedor: VendedorTabla): void {
    this.vendedorEnModal = vendedor;
    this.supervisorSeleccionado = String(vendedor.id_supervisor ?? vendedor.idSupervisor ?? '');
    this.modalAsignarVisible = true;
    this.cdr.detectChanges();
  }

  cerrarModalAsignar(): void {
    this.modalAsignarVisible = false;
    this.vendedorEnModal = null;
    this.supervisorSeleccionado = '';
    this.asignandoSupervisor = false;
    this.cdr.detectChanges();
  }

  asignarSupervisor(): void {
    if (!this.vendedorEnModal || !this.supervisorSeleccionado) {
      return;
    }

    this.asignandoSupervisor = true;

    const vendedorActual = this.vendedorEnModal;
    const codigoVendedor = String(vendedorActual.codVendedor ?? vendedorActual.codigo_vendedor ?? '').trim();
    
    // Buscar el ID del vendedor en el mapa cargado desde /vendedor
    let idVendedor = this.codigoVendedorAIdMap.get(codigoVendedor);
    
    // Si no lo encuentra en el mapa, intentar usar el id_vendedor del objeto (por si acaso)
    if (!idVendedor) {
      idVendedor = vendedorActual.id_vendedor ?? vendedorActual.idVendedor;
    }
    
    const idSupervisor = this.supervisorSeleccionado;

    if (!idVendedor) {
      this.asignandoSupervisor = false;
      console.error('No se encontró el ID del vendedor con código:', codigoVendedor);
      return;
    }

    this.usuariosService
      .asignarSupervisor(String(idVendedor), idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const idx = this.todosLosVendedores.findIndex(
            (v) => v.codVendedor === vendedorActual.codVendedor,
          );

          if (idx >= 0) {
            const idSupervisorNum = Number(idSupervisor);
            const supervisorAsignado = this.supervisoresList.find(
              (s) => Number(s.id_usuario ?? s.idUsuario ?? s.id ?? 0) === idSupervisorNum,
            );
            const nombreSupervisor =
              supervisorAsignado?.username ??
              supervisorAsignado?.nombre ??
              `Supervisor #${idSupervisorNum}`;

            this.todosLosVendedores[idx].id_supervisor = idSupervisorNum;
            this.todosLosVendedores[idx].nombreSupervisor = nombreSupervisor;
            this.supervisorPorCodigoVendedor.set(
              String(this.todosLosVendedores[idx].codVendedor ?? ''),
              nombreSupervisor,
            );
            this.aplicarNombresSupervisorEnTabla();
          }

          this.asignandoSupervisor = false;
          this.cerrarModalAsignar();
          this.recargarSupervisoresPorVendedorAdmin();
        },
        error: (err: any) => {
          console.error('Error asignando supervisor:', err);
          this.asignandoSupervisor = false;
          this.cdr.detectChanges();
        },
      });
  }
}
