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
    
    console.log('👤 Supervisor ID cargado:', this.idSupervisor);
    console.log('👤 Usuario completo:', vendedor);
    
    this.initialized = true;
    this.cargarVendedoresSupervisor();

    // Escuchar cambios en asignaciones de supervisores
    this.usuariosService
      .onSupervisorAsignado()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Recargar vendedores cuando se asigna un supervisor
        console.log('🔄 Recargando vendedores del supervisor...');
        this.cargarVendedoresSupervisor();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['filtrosActivos']) {
      // Actualizar filtros para el análisis cuando cambien los filtros activos
      this.filtrosParaAnalisis = {
        ...this.filtrosActivos,
        codigosVendedores: this.codigosVendedoresAsignados,
      } as DashboardFilters & { codigosVendedores: string[] };
    }

    if (changes['tipoCuota'] || changes['filtrosActivos']) {
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

  private cargarVendedoresSupervisor(): void {
    if (!this.idSupervisor) {
      console.warn('⚠️ ID de supervisor no disponible');
      this.todosLosVendedores = [];
      this.totales = null;
      return;
    }

    console.log('🔍 Cargando vendedores para supervisor ID:', this.idSupervisor);
    this.cargandoVendedores = true;

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
          console.log('✅ Vendedores asignados recibidos:', asignados);
          console.log('✅ Cumplimiento recibido:', cumplimiento?.detalle?.length, 'filas');
          
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

          const listaFiltrada = this.aplicarFiltrosSupervisor(lista);
          console.log('📊 Tabla final con filtros aplicados:', listaFiltrada.length, 'vendedores');
          
          this.todosLosVendedores = listaFiltrada;
          
          // Actualizar códigos de vendedores asignados para el análisis
          this.codigosVendedoresAsignados = listaFiltrada
            .map((v) => String(v.codVendedor ?? '').trim())
            .filter(Boolean);
          
          console.log('📋 Códigos de vendedores asignados:', this.codigosVendedoresAsignados);
          
          // Preparar filtros para el análisis de ventas (solo vendedores asignados).
          // VentasComponent usa codigosVendedores para que el supervisor NO vea datos de todos los vendedores.
          this.filtrosParaAnalisis = {
            ...this.filtrosActivos,
            codigosVendedores: this.codigosVendedoresAsignados,
          } as DashboardFilters & { codigosVendedores: string[] };

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
          this.cdr.detectChanges();
        },
      });
  }
}
