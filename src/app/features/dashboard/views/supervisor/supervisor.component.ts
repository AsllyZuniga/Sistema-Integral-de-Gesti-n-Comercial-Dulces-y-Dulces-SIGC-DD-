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
import { forkJoin, of, Subject, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth.service';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { normalizarTextoFiltro } from '../../../../shared/utils/text-normalization.util';
import { repararNombreMunicipio } from '../../../../shared/utils/narino-municipios.util';
import { TipoCuota } from '../../../cumplimientos-cuota/cumplimientos.component';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { SupervisorCacheService } from '../../../../core/services/supervisor-cache.service';
import { VentasComponent } from '../../components/ventas/ventas.component';
import {
  VendedorTabla,
  VendedoresTableComponent,
} from '../shared/vendedores-table/vendedores-table.component';

interface CumplimientoResponse {
  detalle: any[];
  vendedores?: any[];
  totales?: any;
  periodo?: any;
}

interface CumplimientoTotalesSupervisor {
  ventaAcum: number;
  cuotaMes: number;
  cuotaSemana?: number;
  cuotaDiaria?: number;
  cuotaDia?: number;
  ventaDiaria?: number;
  porcCump: number;
  proyeccionVenta: number;
  promedioDiario?: number;
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
  cuotaDia?: number | CuotaDetalle;
  supervisor?: { username?: string; nombre?: string } | null;
  id_supervisor?: number | string | null;
  idSupervisor?: number | string | null;
  ventaAcum?: number;
  porcCump?: number;
  proyeccionVenta?: number;
}

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent, VendedoresTableComponent, VentasComponent],
  templateUrl: './supervisor.component.html',
  styleUrls: ['./supervisor.component.css'],
})
export class SupervisorDashboardComponent implements OnInit, OnChanges, OnDestroy {
  private usuariosService = inject(UsuariosService);
  private authService = inject(AuthService);
  private cumplimientoService = inject(CumplimientoService);
  private semanaService = inject(CumplimientoSemanaService);
  private supervisorCache = inject(SupervisorCacheService);
  private cdr = inject(ChangeDetectorRef);

  @Input() tipoCuota: TipoCuota = 'mensual';
  @Input() vista: 'asignados' | 'analisis' = 'asignados';
  @Input() filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    linea: '',
  };

  totales: CumplimientoTotalesSupervisor | null = null;
  ventaMesVista: number | null = null;
  cuotaVista: number | null = null;
  porcCumpVista: number | null = null;
  proyeccionVista: number | null = null;
  cargandoVendedores = false;
  todosLosVendedores: VendedorTabla[] = [];
  codigosVendedoresAsignados: string[] = [];
  filtrosParaAnalisis: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    linea: '',
  };

  private idSupervisor = 0;
  private destroy$ = new Subject<void>();
  private initialized = false;
  // OPTIMIZACION: evita recargar vendedores cuando solo cambia la fecha
  // ya que el endpoint /vendedor/supervisor/:id no depende de fechas.
  private ultimaCargaFiltrosKey = '';

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
    // Selección múltiple (CSV) debe tratarse como 'ALL' para que el
    // análisis use el flujo admin-todos (filtra localmente por los
    // códigos seleccionados) en vez del flujo de un solo vendedor.
    if (!codigo || codigo.includes(',')) return 'ALL';
    return codigo;
  }

  onResumenCambio(resumen: {
    ventaAcum?: number;
    cuota?: number;
    porcCump?: number;
    proyeccionVenta?: number;
  }): void {
    const venta = Number(resumen?.ventaAcum ?? 0);
    this.ventaMesVista = Number.isFinite(venta) ? venta : null;
    // FIX: cuando la vista activa (categoría/proveedor/vendedor) no tiene
    // cuota asignada, el total real es 0 y la card KPI debe mostrar 0.
    // Antes "cuota > 0 ? cuota : null" descartaba el 0 real y el template
    // caía al fallback de `totales` (cuota general diaria del equipo, sin
    // relación a la categoría/proveedor filtrado), mostrando un monto que
    // no correspondía a la pestaña activa.
    const cuota = Number(resumen?.cuota ?? 0);
    this.cuotaVista = Number.isFinite(cuota) ? cuota : null;
    const porcCump = Number(resumen?.porcCump ?? 0);
    this.porcCumpVista = Number.isFinite(porcCump) ? porcCump : null;
    const proyeccion = Number(resumen?.proyeccionVenta ?? 0);
    this.proyeccionVista = Number.isFinite(proyeccion) ? proyeccion : null;
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    const vendedor = this.authService.getVendedor();
    this.idSupervisor = Number(vendedor?.id_usuario ?? vendedor?.idUsuario ?? vendedor?.id ?? 0);

    this.initialized = true;
    this.supervisorCache.setIdSupervisor(this.idSupervisor);
    this.cargarVendedoresSupervisor();

    // Escuchar cambios en asignaciones de supervisores
    this.usuariosService
      .onSupervisorAsignado()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Invalidar cache y recargar vendedores cuando se asigna un supervisor
        this.supervisorCache.invalidarVendedores(this.idSupervisor);
        this.usuariosService.invalidarCacheVendedoresPorSupervisor(String(this.idSupervisor));
        this.cargarVendedoresSupervisor();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['filtrosActivos']) {
      // Actualizar filtros para el análisis
      this.filtrosParaAnalisis = {
        ...this.filtrosActivos,
        codigosVendedores: this.codigosVendedoresAsignados,
      } as DashboardFilters & { codigosVendedores: string[] };

      // OPTIMIZACION: si cambiaron las fechas o el vendedor, recargar el
      // cumplimiento contra el backend (los vendors ya estan cacheados, no
      // generan nueva HTTP). Para el resto de filtros (ciudad, proveedor,
      // categoria, linea) alcanza con recalcular localmente sobre los datos
      // ya cargados, vía aplicarFiltrosSupervisor dentro de
      // cargarVendedoresSupervisor.
      const prev = changes['filtrosActivos'].previousValue as DashboardFilters | undefined;
      const curr = this.filtrosActivos;
      const cambioFechas =
        prev?.fechaInicio !== curr?.fechaInicio ||
        prev?.fechaFin !== curr?.fechaFin ||
        prev?.vendedor !== curr?.vendedor;

      const cambioFiltrosLocales =
        prev?.proveedor !== curr?.proveedor ||
        prev?.ciudad !== curr?.ciudad ||
        prev?.ciudadNombre !== curr?.ciudadNombre ||
        prev?.categoria !== curr?.categoria ||
        prev?.linea !== curr?.linea ||
        JSON.stringify(prev?.categorias ?? []) !== JSON.stringify(curr?.categorias ?? []);

      if (cambioFechas) {
        // Invalidar cache de cumplimiento solo si fechas/vendedor cambiaron
        this.cumplimientoService.invalidarCachePorPrefijo('front-');
        this.cumplimientoService.invalidarCachePorPrefijo('me-');
        this.cargarVendedoresSupervisor();
      } else if (cambioFiltrosLocales) {
        this.cargarVendedoresSupervisor(true);
      }
    }

    // Solo recargar vendedores si cambia el TIPO de cuota (mensual/semanal/diaria)
    if (changes['tipoCuota'] && !changes['tipoCuota'].firstChange) {
      this.cargarVendedoresSupervisor();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private normalizarTexto(valor: unknown): string {
    return String(valor ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9\s.,-]/g, '');
  }

  private repararTexto(valor: unknown): string {
    const saneado = normalizarTextoFiltro(
      String(valor ?? '')
        .replace(/◊/g, 'ñ')
        .replace(/Ø/g, 'Ñ'),
    );
    return repararNombreMunicipio(saneado);
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

  private obtenerCodigoVendedor(
    vendedor: Pick<VendedorTabla, 'codVendedor' | 'codigo_vendedor'> | VendedorApiRow | any,
  ): string {
    const codigo =
      vendedor?.codVendedor ??
      vendedor?.codigo_vendedor ??
      vendedor?.codigoVendedor ??
      vendedor?.cod_vendedor ??
      vendedor?.codigo ??
      vendedor?.cod ??
      '';

    return String(codigo ?? '').trim();
  }

  private codigoKeys(codigoRaw: unknown): string[] {
    const codigo = String(codigoRaw ?? '').trim();
    if (!codigo) return [];

    const keys = new Set<string>([codigo]);
    const numerico = codigo.replace(/\D/g, '');
    if (numerico) {
      keys.add(numerico);
      keys.add(String(Number(numerico)));
      keys.add(numerico.padStart(4, '0'));
    }

    return Array.from(keys).filter(Boolean);
  }

  private obtenerDetalleCumplimiento() {
    const obs$ =
      // FIX: /dia/cumplimiento/supervisor/:id devuelve un timeseries por
      // DIA (sin codVendedor por fila), por lo que el merge con `asignados`
      // nunca encontraba coincidencia y la tabla quedaba vacía/en cero.
      // /dia/cumplimiento/front es role-aware por JWT y devuelve una fila
      // por vendedor, igual que semanal/mensual.
      this.tipoCuota === 'diaria'
        ? this.cumplimientoService.getCumplimientoDiaAdmin(this.filtrosActivos)
        : this.tipoCuota === 'semanal'
        ? this.semanaService.getCumplimientoSemanaAdmin(this.filtrosActivos)
        : this.cumplimientoService.getCumplimientoMesAdmin(this.filtrosActivos);

    return obs$.pipe(
      map((res: any): CumplimientoResponse => ({
        detalle: Array.isArray(res?.detalle) ? res.detalle : [],
        vendedores: Array.isArray(res?.vendedores)
          ? res.vendedores
          : Array.isArray(res?.data?.vendedores)
            ? res.data.vendedores
            : [],
        totales: res?.totales ?? res?.data?.totales ?? null,
        periodo: res?.periodo ?? res?.data?.periodo ?? null,
      })),
      catchError(() => of<CumplimientoResponse>({ detalle: [] })),
    );
  }

  private ordenarPorCodigoVendedor(lista: VendedorTabla[]): VendedorTabla[] {
    return [...lista].sort((a, b) => {
      const codigoA = Number(String(a.codVendedor ?? '').trim());
      const codigoB = Number(String(b.codVendedor ?? '').trim());
      if (!isNaN(codigoA) && !isNaN(codigoB)) return codigoA - codigoB;
      return String(a.codVendedor ?? '').localeCompare(String(b.codVendedor ?? ''), 'es', {
        numeric: true,
      });
    });
  }

  private aplicarFiltrosSupervisor(lista: VendedorTabla[]): VendedorTabla[] {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);

    let codVendedorFiltro = String(filtros.vendedor ?? '').trim();
    
    // Si el filtro viene como "123 - John", extraer solo el código
    if (codVendedorFiltro.includes(' - ')) {
      const partes = codVendedorFiltro.split(' - ');
      codVendedorFiltro = String(partes[0] ?? '').trim();
    }
    
    const proveedorFiltro = this.normalizarTexto(filtros.proveedor);
    const categoriasFiltro = Array.isArray(filtros.categorias) && filtros.categorias.length
      ? filtros.categorias.map((item) => this.normalizarTexto(item)).filter(Boolean)
      : [this.normalizarTexto(filtros.categoria)].filter(Boolean);
    const ciudadFiltro = this.normalizarTexto(filtros.ciudadNombre ?? filtros.ciudad ?? '');
    const lineaFiltro = this.normalizarTexto(filtros.linea);

    return lista.filter((v) => {
      if (codVendedorFiltro) {
        const codigoV = String(v.codVendedor ?? v.codigo_vendedor ?? '').trim();
        // Permitir coincidencia flexible: igualdad o inclusión
        if (codigoV !== codVendedorFiltro && !codigoV.includes(codVendedorFiltro)) {
          return false;
        }
      }

      if (proveedorFiltro) {
        const proveedorV = this.normalizarTexto(v.proveedor ?? v.nomProveedor ?? v.nombreProveedor);
        if (!proveedorV.includes(proveedorFiltro)) return false;
      }

      if (categoriasFiltro.length) {
        const categoriaV = this.normalizarTexto(v.categoria ?? v.nomCategoria ?? v.nombreCategoria);
        const coincideCategoria = categoriasFiltro.some(
          (categoriaFiltro) =>
            categoriaV === categoriaFiltro || categoriaV.includes(categoriaFiltro),
        );
        if (!coincideCategoria) return false;
      }

      if (ciudadFiltro) {
        const ciudadV = this.normalizarTexto(
          this.repararTexto(v.ciudad ?? v.nomCiudad ?? v.nombreCiudad),
        );
        if (ciudadV !== ciudadFiltro) return false;
      }

      if (lineaFiltro) {
        const lineaV = this.normalizarTexto(v.linea ?? v.nomLinea ?? v.nombreLinea);
        if (!lineaV.includes(lineaFiltro)) return false;
      }

      return true;
    });
  }

  private cargarVendedoresSupervisor(forzarRecalculo = false): void {
    if (!this.idSupervisor) {
      this.todosLosVendedores = [];
      this.totales = null;
      return;
    }

    // OPTIMIZACION: si ya tenemos vendedores cargados y solo cambiaron las fechas,
    // NO recargar /vendedor/supervisor/:id (no depende de fechas).
    // Solo recargar el cumplimiento (que si depende de fechas).
    // forzarRecalculo se usa cuando cambió un filtro local (ciudad,
    // proveedor, categoria, linea): no requiere nueva llamada HTTP (los
    // servicios ya cachean), pero sí recalcular listaFiltrada/totales.
    const filtrosKey = `${this.tipoCuota}|${this.filtrosActivos?.fechaInicio ?? ''}|${this.filtrosActivos?.fechaFin ?? ''}`;
    const yaHayVendedores = this.codigosVendedoresAsignados.length > 0;
    const keyIgual = this.ultimaCargaFiltrosKey === filtrosKey;

    if (yaHayVendedores && keyIgual && !forzarRecalculo) {
      return;
    }

    this.cargandoVendedores = true;
    this.ultimaCargaFiltrosKey = filtrosKey;

    // OPTIMIZACION: solo pedimos los vendors si no los tenemos ya.
    // UsuariosService ahora tiene cache por idSupervisor con shareReplay(1).
    // Si los vendors ya estan cacheados, NO se hace nueva llamada HTTP.
    forkJoin({
      asignados: this.usuariosService.obtenerVendedoresDelSupervisor(String(this.idSupervisor)),
      cumplimiento: this.obtenerDetalleCumplimiento(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({
          asignados,
          cumplimiento,
        }: {
          asignados: VendedorApiRow[];
          cumplimiento: CumplimientoResponse;
        }) => {
          const cumplimientoPorCodigo = new Map<string, any>();

          for (const fila of cumplimiento.detalle ?? []) {
            const codigoFila = this.obtenerCodigoVendedor(fila);
            for (const key of this.codigoKeys(codigoFila)) {
              cumplimientoPorCodigo.set(key, fila);
            }
          }

          const lista = (Array.isArray(asignados) ? asignados : []).map((v) => {
            const codVendedor = this.obtenerCodigoVendedor(v);
            let filaCumplimiento: any = null;

            for (const key of this.codigoKeys(codVendedor)) {
              if (cumplimientoPorCodigo.has(key)) {
                filaCumplimiento = cumplimientoPorCodigo.get(key);
                break;
              }
            }

            return {
              ...v,
              codigo_vendedor: v.codigo_vendedor ?? v.codVendedor,
              codVendedor,
              id_vendedor: v.id_vendedor ?? v.idVendedor,
              idVendedor: v.id_vendedor ?? v.idVendedor,
              cuotaMes: this.leerCuota(filaCumplimiento?.cuotaMes ?? v.cuotaMes, 'cuota_mes'),
              cuotaSemana: this.leerCuota(filaCumplimiento?.cuotaSemana ?? v.cuotaSemana, 'cuota_semana'),
              cuotaDiaria: this.leerCuota(filaCumplimiento?.cuotaDiaria ?? v.cuotaDia, 'cuota_dia'),
              nombreSupervisor: v.supervisor?.username ?? v.supervisor?.nombre ?? 'Sin asignar',
              id_supervisor: v.id_supervisor ?? v.idSupervisor ?? null,
              // FIX: copiar proveedor/categoria/ciudad/linea desde el detalle de
              // cumplimiento (igual que AdministradorComponent.cargarDesdeEndpointAdmin).
              // Sin esto, aplicarFiltrosSupervisor() nunca encuentra coincidencia
              // porque estos campos no vienen en /vendedor/supervisor/:id.
              proveedor: filaCumplimiento?.proveedor ?? v.proveedor,
              nomProveedor: filaCumplimiento?.nomProveedor ?? v.nomProveedor,
              nombreProveedor: filaCumplimiento?.nombreProveedor ?? v.nombreProveedor,
              categoria: filaCumplimiento?.categoria ?? v.categoria,
              nomCategoria: filaCumplimiento?.nomCategoria ?? v.nomCategoria,
              nombreCategoria: filaCumplimiento?.nombreCategoria ?? v.nombreCategoria,
              ciudad: filaCumplimiento?.ciudad ?? v.ciudad,
              nomCiudad: filaCumplimiento?.nomCiudad ?? v.nomCiudad,
              nombreCiudad: filaCumplimiento?.nombreCiudad ?? v.nombreCiudad,
              linea: filaCumplimiento?.linea ?? v.linea,
              nomLinea: filaCumplimiento?.nomLinea ?? v.nomLinea,
              nombreLinea: filaCumplimiento?.nombreLinea ?? v.nombreLinea,
              ventaAcum: Number(filaCumplimiento?.ventaAcum ?? v.ventaAcum ?? 0),
              porcCump: Number(filaCumplimiento?.porcCump ?? v.porcCump ?? 0),
              proyeccionVenta: Number(filaCumplimiento?.proyeccionVenta ?? v.proyeccionVenta ?? 0),
            } as VendedorTabla;
          });

          const listaFiltrada = this.aplicarFiltrosSupervisor(lista);

          this.todosLosVendedores = this.ordenarPorCodigoVendedor(listaFiltrada);

          // Actualizar códigos de vendedores asignados para el análisis
          this.codigosVendedoresAsignados = listaFiltrada
            .map((v) => String(v.codVendedor ?? '').trim())
            .filter(Boolean);

          // Preparar filtros para el análisis de ventas (solo vendedores asignados).
          // VentasComponent usa codigosVendedores para que el supervisor NO vea datos de todos los vendedores.
          this.filtrosParaAnalisis = {
            ...this.filtrosActivos,
            codigosVendedores: this.codigosVendedoresAsignados,
          } as DashboardFilters & { codigosVendedores: string[] };

          // OPTIMIZACION: alimentar al cache service
          this.supervisorCache.setIdSupervisor(this.idSupervisor);

          const ventaAcum = listaFiltrada.reduce((s: number, v) => s + (Number(v.ventaAcum) || 0), 0);
          const cuota = listaFiltrada.reduce((s: number, v) => s + (Number(v[this.campoCuota]) || 0), 0);
          const proyeccionVenta = listaFiltrada.reduce(
            (s: number, v) => s + (Number(v.proyeccionVenta) || 0),
            0,
          );
          const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;
          const totalesApi = cumplimiento?.totales ?? null;

          this.totales = {
            ventaAcum:
              Number(totalesApi?.totalVenta ?? totalesApi?.ventaDiaria ?? ventaAcum) || ventaAcum,
            cuotaMes:
              Number(totalesApi?.cuotaMes ?? totalesApi?.cuotaDia ?? cuota) || cuota,
            cuotaSemana: Number(totalesApi?.cuotaSemana ?? 0) || undefined,
            cuotaDiaria: Number(totalesApi?.cuotaDiaria ?? totalesApi?.cuotaDia ?? 0) || undefined,
            cuotaDia: Number(totalesApi?.cuotaDia ?? 0) || undefined,
            ventaDiaria: Number(totalesApi?.ventaDiaria ?? 0) || undefined,
            porcCump: Number(totalesApi?.porcCump ?? porcCump) || porcCump,
            proyeccionVenta:
              Number(totalesApi?.promedioDiario ?? totalesApi?.proyeccionVenta ?? proyeccionVenta) ||
              proyeccionVenta,
            promedioDiario: Number(totalesApi?.promedioDiario ?? 0) || undefined,
          };
          if (this.ventaMesVista === null) {
            this.ventaMesVista = this.totales.ventaAcum;
          }
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('❌ Error cargando vendedores del supervisor:', err);
          this.cargandoVendedores = false;
          this.totales = null;
          this.todosLosVendedores = [];
          this.codigosVendedoresAsignados = [];
          this.cdr.detectChanges();
        },
      });
  }
}
