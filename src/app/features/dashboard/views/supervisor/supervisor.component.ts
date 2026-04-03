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
import { Subject, takeUntil } from 'rxjs';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { UsuariosService } from '../../../../core/services/usuarios.service';
import { AuthService } from '../../../../core/services/auth.service';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';
import { TipoCuota } from '../../../cumplientosCuota/cumplimientos.component';
import { VendedoresTableComponent } from '../shared/vendedores-table/vendedores-table.component';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent, VendedoresTableComponent],
  templateUrl: './supervisor.component.html',
  styleUrls: ['./supervisor.component.css'],
})
export class SupervisorDashboardComponent implements OnInit, OnChanges, OnDestroy {
  private usuariosService = inject(UsuariosService);
  private authService = inject(AuthService);
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
    const vendedor = this.authService.getVendedor();
    this.idSupervisor = Number(vendedor?.id_usuario ?? vendedor?.idUsuario ?? vendedor?.id ?? 0);
    this.initialized = true;
    this.cargarVendedoresSupervisor();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.initialized) return;

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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private repararTexto(valor: unknown): string {
    return String(valor ?? '')
      .replace(/�/g, 'a')
      .trim();
  }

  private aplicarFiltrosSupervisor(lista: any[]): any[] {
    const filtros = this.filtrosActivos ?? ({} as DashboardFilters);

    const codVendedorFiltro = String(filtros.vendedor ?? '').trim();
    const proveedorFiltro = this.normalizarTexto(filtros.proveedor);
    const categoriaFiltro = this.normalizarTexto(filtros.categoria);
    const ciudadFiltro = this.normalizarTexto(filtros.ciudadNombre ?? filtros.ciudad ?? '');
    const lineaFiltro = this.normalizarTexto(filtros.linea);

    return lista.filter((v: any) => {
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
      this.todosLosVendedores = [];
      this.totales = null;
      return;
    }

    this.cargandoVendedores = true;

    this.usuariosService
      .obtenerVendedoresDelSupervisor(String(this.idSupervisor))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vendedores: any[]) => {
          const lista = vendedores.map((v: any) => ({
            ...v,
            codVendedor: v.codigo_vendedor ?? v.codVendedor ?? '',
            cuotaMes: Number(v?.cuotaMes?.cuota_mes ?? v?.cuotaMes ?? 0),
            cuotaSemana: Number(v?.cuotaSemana?.cuota_semana ?? v?.cuotaSemana ?? 0),
            cuotaDiaria: Number(v?.cuotaDia?.cuota_dia ?? v?.cuotaDiaria ?? 0),
            nombreSupervisor: v.supervisor?.username ?? v.supervisor?.nombre ?? 'Sin asignar',
            id_supervisor: v.id_supervisor,
            ventaAcum: Number(v.ventaAcum ?? 0),
            porcCump: Number(v.porcCump ?? 0),
            proyeccionVenta: Number(v.proyeccionVenta ?? 0),
          }));

          const listaFiltrada = this.aplicarFiltrosSupervisor(lista);

          this.todosLosVendedores = listaFiltrada;

          const ventaAcum = listaFiltrada.reduce(
            (s: number, v: any) => s + (Number(v.ventaAcum) || 0),
            0,
          );
          const cuota = listaFiltrada.reduce(
            (s: number, v: any) => s + (Number(v[this.campoCuota]) || 0),
            0,
          );
          const proyeccionVenta = listaFiltrada.reduce(
            (s: number, v: any) => s + (Number(v.proyeccionVenta) || 0),
            0,
          );
          const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

          this.totales = { ventaAcum, cuotaMes: cuota, porcCump, proyeccionVenta };
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoVendedores = false;
          this.totales = null;
          this.cdr.detectChanges();
        },
      });
  }
}
