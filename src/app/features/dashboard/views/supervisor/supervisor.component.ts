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
  cargandoVendedores = false;
  todosLosVendedores: VendedorTabla[] = [];
  private vendedoresOriginal: VendedorTabla[] = [];
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
  private codigosVendedoresTodosAsignados: string[] = [];
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
    return codigo || 'ALL';
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
      // Actualizar filtros para el análisis. Los códigos enviados a app-ventas deben ser
      // TODOS los vendedores asignados al supervisor; proveedor/categoría/ciudad viajan
      // como filtros aparte. Si reducimos los códigos por proveedor/categoría aquí,
      // el análisis puede quedarse vacío porque la lista de vendedores asignados no
      // siempre trae esos campos de clasificación.
      this.sincronizarFiltrosParaAnalisis();

      // OPTIMIZACION: si cambiaron las fechas o el vendedor, recargar el cumplimiento
      // (los vendors ya estan cacheados, no generan nueva HTTP).
      const prev = changes['filtrosActivos'].previousValue as DashboardFilters | undefined;
      const curr = this.filtrosActivos;
      const cambioFechas =
        prev?.fechaInicio !== curr?.fechaInicio ||
        prev?.fechaFin !== curr?.fechaFin ||
        prev?.vendedor !== curr?.vendedor;

      const cambioFiltrosCliente =
        prev?.proveedor !== curr?.proveedor ||
        JSON.stringify(prev?.proveedores ?? []) !== JSON.stringify(curr?.proveedores ?? []) ||
        prev?.categoria !== curr?.categoria ||
        JSON.stringify(prev?.categorias ?? []) !== JSON.stringify(curr?.categorias ?? []) ||
        prev?.ciudad !== curr?.ciudad ||
        (prev?.ciudadNombre ?? '') !== (curr?.ciudadNombre ?? '') ||
        (prev?.linea ?? '') !== (curr?.linea ?? '');

      if (cambioFechas) {
        // Invalidar cache de cumplimiento solo si fechas cambiaron
        this.cumplimientoService.invalidarCachePorPrefijo('front-');
        this.cumplimientoService.invalidarCachePorPrefijo('me-');
        this.cargarVendedoresSupervisor();
      } else if (cambioFiltrosCliente && this.vendedoresOriginal.length > 0) {
        // Re-aplicar filtros solo para la tabla de vendedores asignados.
        // El análisis mantiene el alcance completo del supervisor y se filtra internamente
        // por proveedor/categoría/ciudad, igual que administrador.
        this.todosLosVendedores = this.ordenarPorCodigoVendedor(
          this.aplicarFiltrosSupervisor(this.vendedoresOriginal),
        );
        this.codigosVendedoresAsignados = [...this.codigosVendedoresTodosAsignados];
        this.sincronizarFiltrosParaAnalisis();
        this.cdr.detectChanges();
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
    return String(valor ?? '')
      .replace(/◊/g, 'ñ')
      .replace(/Ø/g, 'Ñ')
      .trim();
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

  /**
   * Ordena la lista de vendedores por código de vendedor en orden ascendente.
   * Si el código es numérico, ordena numéricamente; si no, lexicográficamente.
   * Estabiliza la relación original cuando los códigos son iguales.
   */
  private ordenarPorCodigoVendedor(lista: any[]): any[] {
    return [...lista].sort((a, b) => {
      const codA = this.obtenerCodigoVendedor(a);
      const codB = this.obtenerCodigoVendedor(b);

      const numA = Number(codA);
      const numB = Number(codB);
      const aEsNumero = codA !== '' && Number.isFinite(numA);
      const bEsNumero = codB !== '' && Number.isFinite(numB);

      if (aEsNumero && bEsNumero) {
        return numA - numB;
      }

      return codA.localeCompare(codB, 'es', { numeric: true, sensitivity: 'base' });
    });
  }

  private obtenerDetalleCumplimiento() {
    const obs$ =
      this.tipoCuota === 'diaria'
        ? this.cumplimientoService.getCumplimientoDiaSupervisor(this.idSupervisor, this.filtrosActivos)
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

  private aplicarFiltrosSupervisor(lista: VendedorTabla[]): VendedorTabla[] {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);

    let codVendedorFiltro = String(filtros.vendedor ?? '').trim();
    
    // Si el filtro viene como "123 - John", extraer solo el código
    if (codVendedorFiltro.includes(' - ')) {
      const partes = codVendedorFiltro.split(' - ');
      codVendedorFiltro = String(partes[0] ?? '').trim();
    }
    
    const proveedoresFiltro = Array.isArray(filtros.proveedores) && filtros.proveedores.length
      ? filtros.proveedores.map((item) => this.normalizarTexto(item)).filter(Boolean)
      : this.normalizarTexto(filtros.proveedor)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

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

      if (proveedoresFiltro.length) {
        const valoresProveedor = [
          v.proveedor,
          v.nomProveedor,
          v.nombreProveedor,
          (v as any).codigoProveedor,
          (v as any).codigo_proveedor,
          (v as any).id_proveedor,
        ]
          .map((item) => this.normalizarTexto(item))
          .filter(Boolean);

        if (valoresProveedor.length) {
          const coincide = valoresProveedor.some((valorFila) =>
            proveedoresFiltro.some(
              (valorFiltro) => valorFila === valorFiltro || valorFila.includes(valorFiltro),
            ),
          );
          if (!coincide) return false;
        }
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

  private sincronizarFiltrosParaAnalisis(): void {
    this.filtrosParaAnalisis = {
      ...this.filtrosActivos,
      codigosVendedores: this.codigosVendedoresTodosAsignados.length
        ? [...this.codigosVendedoresTodosAsignados]
        : [...this.codigosVendedoresAsignados],
    } as DashboardFilters & { codigosVendedores: string[] };
  }

  private cargarVendedoresSupervisor(): void {
    if (!this.idSupervisor) {
      this.todosLosVendedores = [];
      this.vendedoresOriginal = [];
      this.codigosVendedoresAsignados = [];
      this.codigosVendedoresTodosAsignados = [];
      this.sincronizarFiltrosParaAnalisis();
      this.totales = null;
      return;
    }

    // OPTIMIZACION: si ya tenemos vendedores cargados y solo cambiaron las fechas,
    // NO recargar /vendedor/supervisor/:id (no depende de fechas).
    // Solo recargar el cumplimiento (que si depende de fechas).
    const filtrosKey = `${this.tipoCuota}|${this.filtrosActivos?.fechaInicio ?? ''}|${this.filtrosActivos?.fechaFin ?? ''}`;
    const yaHayVendedores = this.codigosVendedoresAsignados.length > 0;
    const keyIgual = this.ultimaCargaFiltrosKey === filtrosKey;

    if (yaHayVendedores && keyIgual) {
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
              ventaAcum: Number(filaCumplimiento?.ventaAcum ?? v.ventaAcum ?? 0),
              porcCump: Number(filaCumplimiento?.porcCump ?? v.porcCump ?? 0),
              proyeccionVenta: Number(filaCumplimiento?.proyeccionVenta ?? v.proyeccionVenta ?? 0),
            } as VendedorTabla;
          });

          const listaOrdenada = this.ordenarPorCodigoVendedor(lista);
          const listaFiltrada = this.ordenarPorCodigoVendedor(this.aplicarFiltrosSupervisor(lista));

          this.vendedoresOriginal = listaOrdenada;
          this.todosLosVendedores = listaFiltrada;

          // Mantener separados los vendedores visibles de la tabla y el alcance real
          // del análisis. Proveedor/categoría no deben reducir este arreglo porque
          // esos filtros se aplican en las consultas/transformaciones de app-ventas.
          this.codigosVendedoresTodosAsignados = lista
            .map((v) => String(v.codVendedor ?? '').trim())
            .filter(Boolean);
          this.codigosVendedoresAsignados = [...this.codigosVendedoresTodosAsignados];

          // Preparar filtros para el análisis de ventas (solo vendedores asignados).
          // VentasComponent usa codigosVendedores para que el supervisor NO vea datos de todos los vendedores.
          this.sincronizarFiltrosParaAnalisis();

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
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('❌ Error cargando vendedores del supervisor:', err);
          this.cargandoVendedores = false;
          this.totales = null;
          this.todosLosVendedores = [];
          this.codigosVendedoresAsignados = [];
          this.codigosVendedoresTodosAsignados = [];
          this.sincronizarFiltrosParaAnalisis();
          this.cdr.detectChanges();
        },
      });
  }
}
