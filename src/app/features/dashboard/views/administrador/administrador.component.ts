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
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '../../../../shared/components/card/card.component';
import {
  DashboardFilters,
} from '../../../../shared/components/filters/filters.component';
import { CumplimientoService } from '../../../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../../../core/services/ventas/cumplimientoVentasSemana.service';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { TipoCuota } from '../../../cumplientosCuota/cumplimientos.component';
import { VendedoresTableComponent } from '../shared/vendedores-table/vendedores-table.component';

@Component({
  selector: 'app-administrador-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, VendedoresTableComponent],
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

  totales: any = null;
  cargandoVendedores = false;
  todosLosVendedores: any[] = [];

  supervisoresList: any[] = [];
  modalAsignarVisible = false;
  vendedorEnModal: any = null;
  supervisorSeleccionado = '';
  asignandoSupervisor = false;

  private supervisorPorCodigoVendedor: Map<string, string> = new Map();
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

  get campoCuota(): string {
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

  private cargarSupervisores(): void {
    this.usuariosService
      .listarSupervisores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
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

    this.supervisoresList.forEach((supervisor: any) => {
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
          next: (vendedores: any[]) => {
            vendedores.forEach((v: any) => {
              const codigo = String(v?.codigo_vendedor ?? v?.codVendedor ?? '').trim();
              const nombreSupervisor =
                v?.supervisor?.username ??
                v?.supervisor?.nombre ??
                supervisor?.username ??
                supervisor?.nombre ??
                '';

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

  private cargarDesdeEndpointAdmin(obs$: any, campoCuota: string): void {
    this.cargandoVendedores = true;

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const detalle: any[] = (res?.detalle ?? []).filter((v: any) => v.codVendedor !== 'TOTALES');

        const lista = this.filtrosActivos.vendedor
          ? detalle.filter((v: any) => v.codVendedor === this.filtrosActivos.vendedor)
          : detalle;

        this.todosLosVendedores = lista;
        this.aplicarNombresSupervisorEnTabla();

        const ventaAcum = lista.reduce((s: number, v: any) => s + (Number(v.ventaAcum) || 0), 0);
        const cuota = lista.reduce((s: number, v: any) => s + (Number(v[campoCuota]) || 0), 0);
        const proyeccionVenta = lista.reduce(
          (s: number, v: any) => s + (Number(v.proyeccionVenta) || 0),
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

    this.todosLosVendedores = this.todosLosVendedores.map((v: any) => {
      const codigo = String(v?.codVendedor ?? v?.codigo_vendedor ?? '').trim();
      const nombreSupervisor =
        this.supervisorPorCodigoVendedor.get(codigo) ??
        v?.supervisor?.username ??
        v?.supervisor?.nombre ??
        v?.nombreSupervisor ??
        '';

      return { ...v, nombreSupervisor };
    });
  }

  abrirModalAsignar(vendedor: any): void {
    this.vendedorEnModal = vendedor;
    this.supervisorSeleccionado = vendedor?.id_supervisor ?? vendedor?.idSupervisor ?? '';
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

    const codVendedor = this.vendedorEnModal.codVendedor;
    const idSupervisor = this.supervisorSeleccionado;

    if (!codVendedor) {
      this.asignandoSupervisor = false;
      return;
    }

    this.usuariosService
      .asignarSupervisor(codVendedor.toString(), idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const idx = this.todosLosVendedores.findIndex(
            (v) => v.codVendedor === this.vendedorEnModal.codVendedor,
          );

          if (idx >= 0) {
            const idSupervisorNum = Number(idSupervisor);
            const supervisorAsignado = this.supervisoresList.find(
              (s: any) => Number(s.id_usuario ?? s.idUsuario ?? s.id ?? 0) === idSupervisorNum,
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
        error: () => {
          this.asignandoSupervisor = false;
          this.cdr.detectChanges();
        },
      });
  }
}
