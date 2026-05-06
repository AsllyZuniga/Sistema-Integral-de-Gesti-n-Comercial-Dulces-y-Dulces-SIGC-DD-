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
import { TipoCuota } from '../../../cumplimientos-cuota/cumplimientos.component';
import { VentasComponent } from '../../components/ventas/ventas.component';
import {
  VendedorTabla,
  VendedoresTableComponent,
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
  imports: [CommonModule, FormsModule, CardComponent, VendedoresTableComponent, VentasComponent],
  templateUrl: './administrador.component.html',
  styleUrls: ['./administrador.component.css'],
})
export class AdministradorComponent implements OnInit, OnChanges, OnDestroy {
  private cumplimientoService = inject(CumplimientoService);
  private semanaService = inject(CumplimientoSemanaService);
  private usuariosService = inject(UsuariosService);
  private cdr = inject(ChangeDetectorRef);

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

  private obtenerCodigoVendedor(vendedor: Pick<VendedorTabla, 'codVendedor' | 'codigo_vendedor'> | VendedorApiRow): string {
    return String(vendedor.codVendedor ?? vendedor.codigo_vendedor ?? '').trim();
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

  private aplicarFiltrosAdministrador(lista: VendedorTabla[]): VendedorTabla[] {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);

    const codVendedorFiltro = String(filtros.vendedor ?? '').trim();
    const proveedorFiltro = this.normalizarTexto(filtros.proveedor);
    const categoriaFiltro = this.normalizarTexto(filtros.categoria);
    const ciudadFiltro = this.normalizarTexto(filtros.ciudadNombre ?? filtros.ciudad ?? '');
    const lineaFiltro = this.normalizarTexto(filtros.linea);

    return lista.filter((v) => {
      if (codVendedorFiltro) {
        const codigoV = String(v.codVendedor ?? '').trim();
        if (codigoV !== codVendedorFiltro) return false;
      }

      if (proveedorFiltro) {
        const proveedorV = this.normalizarTexto(v.proveedor ?? v.nomProveedor ?? v.nombreProveedor);
        if (!proveedorV.includes(proveedorFiltro)) return false;
      }

      if (categoriaFiltro) {
        const categoriaV = this.normalizarTexto(v.categoria ?? v.nomCategoria ?? v.nombreCategoria);
        if (!categoriaV.includes(categoriaFiltro)) return false;
      }

      if (ciudadFiltro) {
        const ciudadV = this.normalizarTexto(v.ciudad ?? v.nomCiudad ?? v.nombreCiudad);
        if (ciudadV !== ciudadFiltro) return false;
      }

      if (lineaFiltro) {
        const lineaV = this.normalizarTexto(v.linea ?? v.nomLinea ?? v.nombreLinea);
        if (!lineaV.includes(lineaFiltro)) return false;
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
    this.cargarSupervisores();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

    if (changes['tipoCuota'] || changes['filtrosActivos']) {
      this.cargarTotales();
    }
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

          this.catalogoVendedores = catalogo;
          this.todosLosVendedores = catalogo;
          
          console.log('✅ Mapa de vendedores cargado:', this.codigoVendedorAIdMap.size, 'vendedores');
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
                mapaTemporal.set(codigo, nombreSupervisor);
              }
            });
          },
          error: () => finalizar(),
          complete: () => finalizar(),
        });
    });
  }

  private cargarTotales(): void {
    const filtros = { ...this.filtrosActivos };
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

        const baseCatalogo = this.catalogoVendedores.length > 0 ? this.catalogoVendedores : [];
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
            nombreSupervisor: this.obtenerNombreSupervisor(fila ?? base, base.supervisor ? undefined : undefined),
            id_supervisor: fila?.id_supervisor ?? fila?.idSupervisor ?? base.id_supervisor ?? base.idSupervisor ?? null,
            supervisor: fila?.supervisor ?? base.supervisor ?? null,
          };
        });

        const listaFiltrada = this.aplicarFiltrosAdministrador(listaNormalizada);
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
      const nombreSupervisor =
        this.supervisorPorCodigoVendedor.get(codigo) ??
        v.supervisor?.username ??
        v.supervisor?.nombre ??
        v?.nombreSupervisor ??
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
