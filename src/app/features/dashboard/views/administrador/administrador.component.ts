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
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { ProveedorService } from '../../../../core/services/proveedor.service';
import { TipoCuota } from '../../../cumplimientos-cuota/cumplimientos.component';
import { VentasComponent } from '../../components/ventas/ventas.component';
import { VendedorTabla } from '../shared/vendedores-table/vendedores-table.component';

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
  codigo?: string;
  codigoVendedor?: string;
  id_vendedor?: number | string;
  idVendedor?: number | string;
  id_usuario?: number | string;
  idUsuario?: number | string;
  id?: number | string;
  nombre?: string;
  nom_vendedor?: string;
  proveedor?: string;
  nomProveedor?: string;
  nombreProveedor?: string;
  codigoProveedor?: string;
  codigo_proveedor?: string;
  id_proveedor?: string | number;
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
  cuotaDia?: number | CuotaDetalle;
  ventaAcum?: number;
  ventaDiaria?: number;
  porcCump?: number;
  proyeccionVenta?: number;
  promedioDiario?: number;
  nombreSupervisor?: string;
  id_supervisor?: number | string | null;
  idSupervisor?: number | string | null;
  supervisor?: { username?: string; nombre?: string } | null;
  estado?: boolean;
}

interface ApiTotalesResponse<TDetalle> {
  detalle?: TDetalle[];
}

interface ApiTotalesAdminResponse extends ApiTotalesResponse<VendedorApiRow> {
  totales?: {
    cuotaDia?: number;
    cuotaMes?: number;
    cuotaSemana?: number;
    totalVenta?: number;
    ventaDiaria?: number;
    porcCump?: number;
    promedioDiario?: number;
    proyeccionVenta?: number;
    totalDias?: number;
  } | null;
  periodo?: {
    fechaInicio?: string;
    fechaFin?: string;
    totalDias?: number;
  } | null;
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
    ciudadNombre: '',
    linea: '',
  };

  filtrosAnalisis: DashboardFilters = { ...this.filtrosActivos };

  totales: {
    ventaAcum: number;
    cuotaMes: number;
    cuotaSemana?: number;
    cuotaDia?: number;
    porcCump: number;
    proyeccionVenta: number;
    ventaDiaria?: number;
  } | null = null;
  cargandoVendedores = false;
  catalogoVendedores: VendedorTabla[] = [];
  todosLosVendedores: VendedorTabla[] = [];

  supervisoresList: SupervisorResumen[] = [];
  modalAsignarVisible = false;
  vendedorEnModal: VendedorTabla | null = null;
  supervisorSeleccionado = '';
  asignandoSupervisor = false;

  private supervisorPorCodigoVendedor = new Map<string, string>();
  private codigoVendedorAIdMap = new Map<string, string | number>();
  private destroy$ = new Subject<void>();
  private initialized = false;
  private proveedoresList: any[] = [];
  private proveedoresMap = new Map<string, string>();

  get codigoVendedorAnalisis(): string {
    // En administrador siempre se envía ALL a app-ventas.
    // El vendedor filtrado viaja en filtrosAnalisis.vendedor.
    return 'ALL';
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

  ngOnInit(): void {
    this.initialized = true;
    this.actualizarFiltrosAnalisis();
    this.cargarVendedoresDetalle();
    this.cargarProveedores();
    this.cargarSupervisores();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.actualizarFiltrosAnalisis();

    if (!this.initialized) return;

    if (changes['tipoCuota'] || changes['filtrosActivos']) {
      this.cargarTotales();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private extraerCodigoDesdeFiltro(valor: unknown): string {
    const raw = String(valor ?? '').trim();
    if (!raw) return '';

    // Soporta valores como "0002" o "0002 - MENESES GUERRERO VICTOR HUGO".
    const match = raw.match(/^\s*(\d+)/);
    if (match?.[1]) {
      return match[1].padStart(4, '0');
    }

    return raw;
  }

  private actualizarFiltrosAnalisis(): void {
    this.filtrosAnalisis = { ...this.obtenerFiltrosParaApi() };
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9\s.,-]/g, '')
      .replace(/\s+/g, ' ');
  }

  private obtenerCodigoVendedor(
    vendedor: Pick<VendedorTabla, 'codVendedor' | 'codigo_vendedor'> | VendedorApiRow | any,
  ): string {
    return String(
      vendedor?.codVendedor ??
        vendedor?.codigo_vendedor ??
        vendedor?.codigoVendedor ??
        vendedor?.codigo ??
        '',
    ).trim();
  }

  private generarClavesCodigo(codigoRaw: unknown): string[] {
    const codigo = String(codigoRaw ?? '').trim();
    if (!codigo) return [];

    const claves = new Set<string>([codigo]);
    const numerico = codigo.replace(/\D/g, '');

    if (numerico) {
      claves.add(numerico);
      claves.add(String(Number(numerico)));
      claves.add(numerico.padStart(4, '0'));
      claves.add(numerico.replace(/^0+/, '') || numerico);
    }

    return Array.from(claves).filter(Boolean);
  }

  private leerCuota(
    valor: number | CuotaDetalle | null | undefined,
    clave: keyof CuotaDetalle,
  ): number {
    if (typeof valor === 'number') return valor;
    if (valor && typeof valor === 'object') return Number(valor[clave] ?? 0);
    return Number(valor ?? 0);
  }

  private obtenerNombreSupervisor(
    vendedor: VendedorApiRow | VendedorTabla | any,
    supervisor?: SupervisorResumen,
  ): string {
    return (
      vendedor?.supervisor?.username ??
      vendedor?.supervisor?.nombre ??
      supervisor?.username ??
      supervisor?.nombre ??
      vendedor?.nombreSupervisor ??
      ''
    );
  }

  private obtenerValoresVendedorFiltro(valor: unknown): string[] {
    const raw = String(valor ?? '').trim();
    if (!raw) return [];

    const valores = new Set<string>([this.normalizarTexto(raw)]);
    const matchCodigo = raw.match(/^(\d+)/);
    if (matchCodigo?.[1]) valores.add(this.normalizarTexto(matchCodigo[1]));

    const matchEtiqueta = raw.match(/^\s*(\d+)\s*[-–]\s*(.+)$/);
    if (matchEtiqueta?.[1]) {
      valores.add(this.normalizarTexto(matchEtiqueta[1]));
      valores.add(this.normalizarTexto(matchEtiqueta[2]));
    }

    return Array.from(valores).filter(Boolean);
  }

  private obtenerValoresProveedorFiltro(valor: unknown): string[] {
    const raw = String(valor ?? '').trim();
    if (!raw) return [];

    const normalizado = this.normalizarTexto(raw);
    const valores = new Set<string>([normalizado]);
    const codigoMapeado = this.proveedoresMap.get(normalizado);

    if (codigoMapeado) valores.add(this.normalizarTexto(codigoMapeado));

    this.proveedoresList.forEach((p) => {
      const codigo = String(p?.codigo ?? p?.id_proveedor ?? p?.codigoProveedor ?? '').trim();
      const nombre = String(p?.nombre ?? p?.nomProveedor ?? p?.nombreProveedor ?? '').trim();
      const codigoNorm = this.normalizarTexto(codigo);
      const nombreNorm = this.normalizarTexto(nombre);

      if (codigoNorm === normalizado || nombreNorm === normalizado) {
        if (codigoNorm) valores.add(codigoNorm);
        if (nombreNorm) valores.add(nombreNorm);
      }
    });

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
        const valoresFila = [v.codVendedor, v.codigo_vendedor, v.nombre, (v as any).codigoVendedor]
          .map((item) => this.normalizarTexto(item))
          .filter(Boolean);

        const coincide = valoresFila.some((valorFila) =>
          vendedorFiltro.some(
            (valorFiltro) => valorFila === valorFiltro || valorFila.includes(valorFiltro),
          ),
        );

        if (!coincide) return false;
      }

      if (proveedoresFiltro.length) {
        const valoresFila = [
          v.proveedor,
          v.nomProveedor,
          v.nombreProveedor,
          (v as any).codigoProveedor,
          (v as any).codigo_proveedor,
          (v as any).id_proveedor,
        ]
          .map((item) => this.normalizarTexto(item))
          .filter(Boolean);

        if (valoresFila.length) {
          const coincide = valoresFila.some((valorFila) =>
            proveedoresFiltro.some(
              (valorFiltro) => valorFila === valorFiltro || valorFila.includes(valorFiltro),
            ),
          );
          if (!coincide) return false;
        }
      }

      if (categoriaFiltro) {
        const valoresFila = [v.categoria, v.nomCategoria, v.nombreCategoria]
          .map((item) => this.normalizarTexto(item))
          .filter(Boolean);
        if (
          valoresFila.length &&
          !valoresFila.some((valorFila) => valorFila.includes(categoriaFiltro))
        )
          return false;
      }

      if (ciudadFiltro) {
        const valoresFila = [v.ciudad, v.nomCiudad, v.nombreCiudad]
          .map((item) => this.normalizarTexto(item))
          .filter(Boolean);
        if (valoresFila.length && !valoresFila.some((valorFila) => valorFila === ciudadFiltro))
          return false;
      }

      if (lineaFiltro) {
        const valoresFila = [v.linea, v.nomLinea, v.nombreLinea]
          .map((item) => this.normalizarTexto(item))
          .filter(Boolean);
        if (valoresFila.length && !valoresFila.some((valorFila) => valorFila.includes(lineaFiltro)))
          return false;
      }

      return true;
    });
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
            const codigo = String(p?.codigo ?? p?.id_proveedor ?? '').trim();
            const nombre = this.normalizarTexto(p?.nombre ?? '');

            if (codigo) this.proveedoresMap.set(this.normalizarTexto(codigo), codigo);
            if (nombre && codigo) this.proveedoresMap.set(nombre, codigo);
          });

          this.actualizarFiltrosAnalisis();

          if (this.initialized) this.cargarTotales();
        },
        error: (err: any) => console.error('Error cargando proveedores en Administrador:', err),
      });
  }

  private obtenerFiltrosParaApi(): DashboardFilters {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);
    const provRaw = String(filtros.proveedor ?? '').trim();
    const vendedorRaw = String(filtros.vendedor ?? '').trim();

    const codigoProveedor = provRaw
      ? (this.proveedoresMap.get(this.normalizarTexto(provRaw)) ?? provRaw)
      : '';

    return {
      ...filtros,
      proveedor: codigoProveedor,
      vendedor: this.extraerCodigoDesdeFiltro(vendedorRaw),
    };
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
            const codigo = this.obtenerCodigoVendedor(vendedor);
            const nombre = String(vendedor.nombre ?? vendedor.nom_vendedor ?? '').trim();
            const idVendedor =
              vendedor.id_vendedor ??
              vendedor.idVendedor ??
              vendedor.id_usuario ??
              vendedor.idUsuario ??
              vendedor.id;

            if (codigo && idVendedor) this.codigoVendedorAIdMap.set(codigo, idVendedor);

            if (codigo) {
              catalogo.push({
                codigo_vendedor: codigo,
                codVendedor: codigo,
                id_vendedor: idVendedor,
                idVendedor,
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
                estado: vendedor.estado,
              });
            }
          });

          catalogo.sort((a, b) =>
            String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es', {
              sensitivity: 'base',
            }),
          );

          this.catalogoVendedores = [...catalogo];
          this.todosLosVendedores = [...catalogo];

          if (this.initialized) this.cargarTotales();
        },
        error: (err: any) => console.error('Error cargando vendedores:', err),
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
            (Array.isArray(vendedores) ? vendedores : []).forEach((v) => {
              const codigo = this.obtenerCodigoVendedor(v);
              const nombreSupervisor = this.obtenerNombreSupervisor(v, supervisor);

              if (codigo && nombreSupervisor) {
                this.generarClavesCodigo(codigo).forEach((clave) =>
                  mapaTemporal.set(clave, nombreSupervisor),
                );
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
      this.tipoCuota === 'diaria'
        ? this.cumplimientoService.getCumplimientoDiaAdmin(filtros)
        : this.tipoCuota === 'semanal'
        ? this.semanaService.getCumplimientoSemanaAdmin(filtros)
        : this.cumplimientoService.getCumplimientoMesAdmin(filtros);

    this.cargarDesdeEndpointAdmin(obs$, this.campoCuota);
  }

  private cargarDesdeEndpointAdmin(
    obs$: Observable<ApiTotalesAdminResponse>,
    campoCuota: keyof Pick<VendedorTabla, 'cuotaMes' | 'cuotaSemana' | 'cuotaDiaria'>,
  ): void {
    this.cargandoVendedores = true;

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: ApiTotalesAdminResponse) => {
        const detalle = (res?.detalle ?? []).filter(
          (v) => this.obtenerCodigoVendedor(v) !== 'TOTALES',
        );
        const detallePorCodigo = new Map<string, VendedorApiRow>();

        detalle.forEach((fila: VendedorApiRow) => {
          const codigo = this.obtenerCodigoVendedor(fila);
          if (codigo) {
            this.generarClavesCodigo(codigo).forEach((clave) => detallePorCodigo.set(clave, fila));
          }
        });

        const baseCatalogo =
          this.catalogoVendedores.length > 0
            ? this.catalogoVendedores
            : detalle.map(
                (fila: VendedorApiRow) =>
                  ({
                    codigo_vendedor: this.obtenerCodigoVendedor(fila),
                    codVendedor: this.obtenerCodigoVendedor(fila),
                    id_vendedor: fila.id_vendedor ?? fila.idVendedor,
                    idVendedor: fila.id_vendedor ?? fila.idVendedor,
                    nombre: fila.nombre ?? fila.nom_vendedor ?? '',
                  }) as VendedorTabla,
              );

        const listaNormalizada: VendedorTabla[] = baseCatalogo.map((base) => {
          const codigo = this.obtenerCodigoVendedor(base);
          let fila: VendedorApiRow | undefined;

          for (const clave of this.generarClavesCodigo(codigo)) {
            fila = detallePorCodigo.get(clave);
            if (fila) break;
          }

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
            cuotaDiaria: this.leerCuota(
              fila?.cuotaDiaria ?? fila?.cuotaDia ?? 0,
              'cuota_dia',
            ),
            ventaAcum: Number(fila?.ventaAcum ?? fila?.ventaDiaria ?? 0),
            porcCump: Number(fila?.porcCump ?? 0),
            proyeccionVenta: Number(fila?.proyeccionVenta ?? fila?.promedioDiario ?? 0),
            nombreSupervisor: this.obtenerNombreSupervisor(fila ?? base),
            id_supervisor:
              fila?.id_supervisor ??
              fila?.idSupervisor ??
              base.id_supervisor ??
              base.idSupervisor ??
              null,
            supervisor: fila?.supervisor ?? base.supervisor ?? null,
            estado: fila?.estado ?? base.estado,
          };
        });

        const hayFiltros = !!String(
          this.filtrosActivos?.proveedor ||
            this.filtrosActivos?.categoria ||
            this.filtrosActivos?.ciudad ||
            this.filtrosActivos?.ciudadNombre ||
            this.filtrosActivos?.linea ||
            this.filtrosActivos?.vendedor ||
            '',
        ).trim();

        const listaBase = hayFiltros
          ? listaNormalizada.filter((v) => {
              const codigo = this.obtenerCodigoVendedor(v);
              return this.generarClavesCodigo(codigo).some((clave) => detallePorCodigo.has(clave));
            })
          : listaNormalizada;

        this.todosLosVendedores = this.aplicarFiltrosAdministrador(listaBase);
        this.aplicarNombresSupervisorEnTabla();

        const ventaAcum = this.todosLosVendedores.reduce(
          (s, v) => s + (Number(v.ventaAcum) || 0),
          0,
        );
        const cuota = this.todosLosVendedores.reduce((s, v) => s + (Number(v[campoCuota]) || 0), 0);
        const proyeccionVenta = this.todosLosVendedores.reduce(
          (s, v) => s + (Number(v.proyeccionVenta) || 0),
          0,
        );
        const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

        const totalesApi = res?.totales ?? null;

        this.totales = {
          ventaAcum:
            Number(totalesApi?.totalVenta ?? totalesApi?.ventaDiaria ?? ventaAcum) || ventaAcum,
          cuotaMes:
            Number(totalesApi?.cuotaMes ?? totalesApi?.cuotaDia ?? cuota) || cuota,
          cuotaDia: Number(totalesApi?.cuotaDia ?? 0) || undefined,
          porcCump: Number(totalesApi?.porcCump ?? porcCump) || porcCump,
          proyeccionVenta:
            Number(totalesApi?.promedioDiario ?? totalesApi?.proyeccionVenta ?? proyeccionVenta) ||
            proyeccionVenta,
          ventaDiaria: Number(totalesApi?.ventaDiaria ?? 0) || undefined,
        };
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error cargando totales administrador:', err);
        this.totales = null;
        this.todosLosVendedores = [];
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

      for (const clave of this.generarClavesCodigo(codigo)) {
        const encontrado = this.supervisorPorCodigoVendedor.get(clave);
        if (encontrado) {
          nombreSupervisor = encontrado;
          break;
        }
      }

      nombreSupervisor =
        nombreSupervisor ||
        v.supervisor?.username ||
        v.supervisor?.nombre ||
        v.nombreSupervisor ||
        '';
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
    if (!this.vendedorEnModal || !this.supervisorSeleccionado) return;

    this.asignandoSupervisor = true;

    const vendedorActual = this.vendedorEnModal;
    const codigoVendedor = this.obtenerCodigoVendedor(vendedorActual);
    let idVendedor = this.codigoVendedorAIdMap.get(codigoVendedor);

    if (!idVendedor) idVendedor = vendedorActual.id_vendedor ?? vendedorActual.idVendedor;

    if (!idVendedor) {
      this.asignandoSupervisor = false;
      console.error('No se encontró el ID del vendedor con código:', codigoVendedor);
      return;
    }

    this.usuariosService
      .asignarSupervisor(String(idVendedor), this.supervisorSeleccionado)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const idSupervisorNum = Number(this.supervisorSeleccionado);
          const supervisorAsignado = this.supervisoresList.find(
            (s) => Number(s.id_usuario ?? s.idUsuario ?? s.id ?? 0) === idSupervisorNum,
          );
          const nombreSupervisor =
            supervisorAsignado?.username ??
            supervisorAsignado?.nombre ??
            `Supervisor #${idSupervisorNum}`;

          this.todosLosVendedores = this.todosLosVendedores.map((v) =>
            this.obtenerCodigoVendedor(v) === codigoVendedor
              ? { ...v, id_supervisor: idSupervisorNum, nombreSupervisor }
              : v,
          );

          this.generarClavesCodigo(codigoVendedor).forEach((clave) =>
            this.supervisorPorCodigoVendedor.set(clave, nombreSupervisor),
          );

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

  editarVendedor(vendedor: VendedorTabla): void {
    console.log('Editar vendedor:', vendedor);
  }

  desactivarVendedor(vendedor: VendedorTabla): void {
    console.log('Activar/desactivar vendedor:', vendedor);
  }
}
