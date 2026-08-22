import { Component, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { UsuariosService } from '../../../core/services/usuarios.service';
import { CuotasCrudService, CuotaRegistro } from '../../../core/services/cuotas-crud.service';

import { CuotaVendedorUploadComponent } from './cuota-vendedor-upload/cuota-vendedor-upload.component';
import { CuotaProveedorUploadComponent } from './cuota-proveedor-upload/cuota-proveedor-upload.component';
import { CuotaCategoriaUploadComponent } from './cuota-categoria-upload/cuota-categoria-upload.component';
import { ImpactoClienteUploadComponent } from './impacto-cliente-upload/impacto-cliente-upload.component';
import { ImpactoProveedorUploadComponent } from './impacto-proveedor-upload/impacto-proveedor-upload.component';
import { ImpactoCategoriaUploadComponent } from './impacto-categoria-upload/impacto-categoria-upload.component';

import {
  CuotasUploadService,
  EliminarCuotasResponse,
} from '../../../core/services/cuotas-upload.service';

@Component({
  selector: 'app-carga-cuotas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    TopbarComponent,
    CuotaVendedorUploadComponent,
    CuotaProveedorUploadComponent,
    CuotaCategoriaUploadComponent,
    ImpactoClienteUploadComponent,
    ImpactoProveedorUploadComponent,
    ImpactoCategoriaUploadComponent,
  ],
  templateUrl: './carga-cuotas.component.html',
  styleUrls: ['./carga-cuotas.component.css'],
})
export class CargaCuotasComponent implements OnInit {
  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  sidebarColapsado = false;
  pestanaActiva: 'cargar' | 'eliminar' | 'editar' = 'cargar';
  tipoCuota: 'vendedor' | 'proveedor' | 'categoria' = 'vendedor';
  tipoEliminar: 'vendedor' | 'proveedor' | 'categoria' = 'vendedor';

  setPestana(pestana: 'cargar' | 'eliminar' | 'editar'): void {
    this.pestanaActiva = pestana;
  }

  setTipoCuota(tipo: 'vendedor' | 'proveedor' | 'categoria'): void {
    this.tipoCuota = tipo;
  }

  setTipoEliminar(tipo: 'vendedor' | 'proveedor' | 'categoria'): void {
    this.tipoEliminar = tipo;
  }

  // Eliminar cuota proveedor/línea
  fechaInicioCuotaProveedor: string | null = null;
  fechaFinCuotaProveedor: string | null = null;
  eliminandoCuotaProveedor = false;
  mensajeOperacionCuotaProveedor: string | null = null;
  tipoOperacionCuotaProveedor: 'success' | 'error' | null = null;
  showConfirmCuotaProveedorModal = false;
  confirmInputCuotaProveedor = '';

  // Eliminar cuota categoría
  fechaInicioCuotaCategoria: string | null = null;
  fechaFinCuotaCategoria: string | null = null;
  eliminandoCuotaCategoria = false;
  mensajeOperacionCuotaCategoria: string | null = null;
  tipoOperacionCuotaCategoria: 'success' | 'error' | null = null;
  showConfirmCuotaCategoriaModal = false;
  confirmInputCuotaCategoria = '';

  // Eliminar cuotas de vendedor (mensual + semanal + diaria)
  vendedores: any[] = [];
  cargandoVendedores = false;
  idsUsuariosCuotaVendedor: (string | number)[] = [];
  seleccionarTodosVendedoresCuota = false;
  vendedorSelectorAbierto = false;
  fechaInicioCuotaVendedor: string | null = null;
  fechaFinCuotaVendedor: string | null = null;
  eliminandoCuotaVendedor = false;
  mensajeOperacionCuotaVendedor: string | null = null;
  tipoOperacionCuotaVendedor: 'success' | 'error' | null = null;
  showConfirmCuotaVendedorModal = false;
  confirmInputCuotaVendedor = '';

  // Histórico de cuotas del vendedor seleccionado (tabla individual)
  cuotasMesVendedor: CuotaRegistro[] = [];
  cuotasSemanaVendedor: CuotaRegistro[] = [];
  cuotasDiaVendedor: CuotaRegistro[] = [];
  cargandoHistoricoCuotas = false;
  eliminandoCuotaIndividualId: number | null = null;

  // Editar cuotas de vendedor (mensual + semanal + diaria + categoría)
  tipoCuotaEditar: 'mes' | 'semana' | 'dia' | 'categoria' | 'proveedor'
               | 'impacto_cliente' | 'impacto_proveedor' | 'impacto_categoria' = 'mes';
  idUsuarioEditar = '';
  busquedaProveedorEditar = '';
  fechaInicioEditar: string | null = null;
  fechaFinEditar: string | null = null;
  cuotasEditar: CuotaRegistro[] = [];
  cargandoCuotasEditar = false;
  editandoCuotaId: number | null = null;
  valorEditado: number | null = null;
  guardandoCuotaId: number | null = null;
  mensajeOperacionEditar: string | null = null;
  tipoOperacionEditar: 'success' | 'error' | null = null;

  constructor(
    private cd: ChangeDetectorRef,
    private auth: AuthService,
    private cuotasUploadService: CuotasUploadService,
    private usuariosService: UsuariosService,
    private cuotasCrudService: CuotasCrudService,
  ) {}

  ngOnInit(): void {
    this.cargandoVendedores = true;

    forkJoin({
      usuarios: this.usuariosService.listarVendedores(),
      detalleVendedores: this.usuariosService.listarDetalleVendedores(),
    }).subscribe({
      next: ({ usuarios, detalleVendedores }) => {
        this.vendedores = this.enriquecerYOrdenarVendedores(usuarios ?? [], detalleVendedores ?? []);
        this.cargandoVendedores = false;
        this.cd.detectChanges();
      },
      error: () => {
        this.vendedores = [];
        this.cargandoVendedores = false;
        this.cd.detectChanges();
      },
    });
  }

  private codigoSinCeros(value: any): string {
    const codigo = String(value ?? '').trim();
    if (!codigo) return '';
    return codigo.replace(/^0+/, '') || '0';
  }

  private enriquecerYOrdenarVendedores(usuarios: any[], detalleVendedores: any[]): any[] {
    const detallePorIdUsuario = new Map<
      string,
      { codigo: string; nombre: string; idVendedor: string }
    >();
    const detallePorCodigo = new Map<
      string,
      { codigo: string; nombre: string; idVendedor: string }
    >();

    (detalleVendedores ?? []).forEach((detalle: any) => {
      const idUsuario = String(
        detalle?.id_usuario ?? detalle?.idUsuario ?? detalle?.usuario?.id_usuario ?? '',
      ).trim();
      const codigo = String(
        detalle?.codigo_vendedor ?? detalle?.codVendedor ?? detalle?.codigo ?? '',
      ).trim();
      const nombre = String(detalle?.nombre ?? detalle?.nom_vendedor ?? '').trim();
      const idVendedor = String(
        detalle?.id_vendedor ?? detalle?.idVendedor ?? detalle?.id ?? '',
      ).trim();
      const entrada = { codigo, nombre, idVendedor };

      if (idUsuario) {
        detallePorIdUsuario.set(idUsuario, entrada);
      }

      if (codigo) {
        detallePorCodigo.set(codigo, entrada);
        detallePorCodigo.set(this.codigoSinCeros(codigo), entrada);
      }
    });

    const conDatos = usuarios.map((v: any) => {
      const idUsuario = String(v?.id_usuario ?? v?.id ?? '').trim();
      const codigoUsuario = String(
        v?.codigo ?? v?.codigo_vendedor ?? v?.codVendedor ?? v?.username ?? '',
      ).trim();

      const detalle =
        detallePorIdUsuario.get(idUsuario) ??
        detallePorCodigo.get(codigoUsuario) ??
        detallePorCodigo.get(this.codigoSinCeros(codigoUsuario));

      return {
        ...v,
        codigo_vendedor: v?.codigo_vendedor || detalle?.codigo || codigoUsuario || '',
        nombre: v?.nombre || detalle?.nombre || v?.username || '',
        id_vendedor: v?.id_vendedor || detalle?.idVendedor || '',
      };
    });

    return conDatos.sort((a, b) => this.compararPorCodigo(a.codigo_vendedor, b.codigo_vendedor));
  }

  private compararPorCodigo(codigoA: any, codigoB: any): number {
    const textoA = String(codigoA ?? '').trim();
    const textoB = String(codigoB ?? '').trim();

    if (!textoA && !textoB) return 0;
    if (!textoA) return 1;
    if (!textoB) return -1;

    return textoA.localeCompare(textoB, undefined, { numeric: true, sensitivity: 'base' });
  }

  get periodoCuotaProveedorSeleccionado(): string {
    if (!this.fechaInicioCuotaProveedor || !this.fechaFinCuotaProveedor) {
      return 'periodo no seleccionado';
    }

    return `${this.fechaInicioCuotaProveedor} - ${this.fechaFinCuotaProveedor}`;
  }

  get periodoCuotaCategoriaSeleccionado(): string {
    if (!this.fechaInicioCuotaCategoria || !this.fechaFinCuotaCategoria) {
      return 'periodo no seleccionado';
    }

    return `${this.fechaInicioCuotaCategoria} - ${this.fechaFinCuotaCategoria}`;
  }

  onToggleSidebar(colapsado: boolean): void {
    this.sidebarColapsado = colapsado;
    this.cd.detectChanges();
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  logout(): void {
    this.auth.logout();
  }

  // ─────────────────────────────────────────────
  // Eliminar proveedor / línea
  // ─────────────────────────────────────────────

  onCambiarFechaEliminarCuotaProveedor(): void {
    this.mensajeOperacionCuotaProveedor = null;
    this.tipoOperacionCuotaProveedor = null;
    this.cd.detectChanges();
  }

  openConfirmEliminarCuotaProveedor(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicioCuotaProveedor);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFinCuotaProveedor);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.mensajeOperacionCuotaProveedor =
        'Seleccione fecha inicio y fecha fin para eliminar cuotas de proveedor/línea.';
      this.tipoOperacionCuotaProveedor = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.mensajeOperacionCuotaProveedor = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacionCuotaProveedor = 'error';
      this.cd.detectChanges();
      return;
    }

    this.mensajeOperacionCuotaProveedor = null;
    this.tipoOperacionCuotaProveedor = null;
    this.confirmInputCuotaProveedor = '';
    this.showConfirmCuotaProveedorModal = true;
    this.cd.detectChanges();
  }

  closeConfirmCuotaProveedor(): void {
    if (this.eliminandoCuotaProveedor) return;

    this.showConfirmCuotaProveedorModal = false;
    this.confirmInputCuotaProveedor = '';
    this.cd.detectChanges();
  }

  finalDeleteCuotaProveedor(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicioCuotaProveedor);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFinCuotaProveedor);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.showConfirmCuotaProveedorModal = false;
      this.mensajeOperacionCuotaProveedor = 'Fechas inválidas. Use el formato YYYY-MM-DD.';
      this.tipoOperacionCuotaProveedor = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.showConfirmCuotaProveedorModal = false;
      this.mensajeOperacionCuotaProveedor = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacionCuotaProveedor = 'error';
      this.cd.detectChanges();
      return;
    }

    if (this.confirmInputCuotaProveedor !== 'ELIMINAR') {
      return;
    }

    this.eliminandoCuotaProveedor = true;
    this.mensajeOperacionCuotaProveedor = null;
    this.tipoOperacionCuotaProveedor = null;
    this.cd.detectChanges();

    this.cuotasUploadService
      .eliminarCuotasProveedorPorFechas(fechaIsoInicio, fechaIsoFin)
      .subscribe({
        next: (res: EliminarCuotasResponse | string) => {
          const mensaje =
            typeof res === 'string'
              ? res
              : res?.message ||
                res?.mensaje ||
                `Cuotas de proveedor/línea eliminadas correctamente para el período ${fechaIsoInicio} - ${fechaIsoFin}.`;

          this.eliminandoCuotaProveedor = false;
          this.showConfirmCuotaProveedorModal = false;
          this.confirmInputCuotaProveedor = '';
          this.mensajeOperacionCuotaProveedor = mensaje;
          this.tipoOperacionCuotaProveedor = 'success';
          this.cd.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          const backendMessage = this.extraerMensajeError(err);

          this.eliminandoCuotaProveedor = false;
          this.showConfirmCuotaProveedorModal = false;
          this.confirmInputCuotaProveedor = '';

          this.mensajeOperacionCuotaProveedor =
            backendMessage ||
            `Error al eliminar cuotas de proveedor/línea para el período ${fechaIsoInicio} - ${fechaIsoFin}.`;

          this.tipoOperacionCuotaProveedor = 'error';
          this.cd.detectChanges();
        },
      });
  }

  // ─────────────────────────────────────────────
  // Eliminar categoría
  // ─────────────────────────────────────────────

  onCambiarFechaEliminarCuotaCategoria(): void {
    this.mensajeOperacionCuotaCategoria = null;
    this.tipoOperacionCuotaCategoria = null;
    this.cd.detectChanges();
  }

  openConfirmEliminarCuotaCategoria(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicioCuotaCategoria);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFinCuotaCategoria);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.mensajeOperacionCuotaCategoria =
        'Seleccione fecha inicio y fecha fin para eliminar cuotas por categoría.';
      this.tipoOperacionCuotaCategoria = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.mensajeOperacionCuotaCategoria = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacionCuotaCategoria = 'error';
      this.cd.detectChanges();
      return;
    }

    this.mensajeOperacionCuotaCategoria = null;
    this.tipoOperacionCuotaCategoria = null;
    this.confirmInputCuotaCategoria = '';
    this.showConfirmCuotaCategoriaModal = true;
    this.cd.detectChanges();
  }

  closeConfirmCuotaCategoria(): void {
    if (this.eliminandoCuotaCategoria) return;

    this.showConfirmCuotaCategoriaModal = false;
    this.confirmInputCuotaCategoria = '';
    this.cd.detectChanges();
  }

  finalDeleteCuotaCategoria(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicioCuotaCategoria);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFinCuotaCategoria);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.showConfirmCuotaCategoriaModal = false;
      this.mensajeOperacionCuotaCategoria = 'Fechas inválidas. Use el formato YYYY-MM-DD.';
      this.tipoOperacionCuotaCategoria = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.showConfirmCuotaCategoriaModal = false;
      this.mensajeOperacionCuotaCategoria = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacionCuotaCategoria = 'error';
      this.cd.detectChanges();
      return;
    }

    if (this.confirmInputCuotaCategoria !== 'ELIMINAR') {
      return;
    }

    this.eliminandoCuotaCategoria = true;
    this.mensajeOperacionCuotaCategoria = null;
    this.tipoOperacionCuotaCategoria = null;
    this.cd.detectChanges();

    this.cuotasUploadService
      .eliminarCuotasCategoriaPorFechas(fechaIsoInicio, fechaIsoFin)
      .subscribe({
        next: (res: EliminarCuotasResponse | string) => {
          const mensaje =
            typeof res === 'string'
              ? res
              : res?.message ||
                res?.mensaje ||
                `Cuotas por categoría eliminadas correctamente para el período ${fechaIsoInicio} - ${fechaIsoFin}.`;

          this.eliminandoCuotaCategoria = false;
          this.showConfirmCuotaCategoriaModal = false;
          this.confirmInputCuotaCategoria = '';
          this.mensajeOperacionCuotaCategoria = mensaje;
          this.tipoOperacionCuotaCategoria = 'success';
          this.cd.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          const backendMessage = this.extraerMensajeError(err);

          this.eliminandoCuotaCategoria = false;
          this.showConfirmCuotaCategoriaModal = false;
          this.confirmInputCuotaCategoria = '';

          this.mensajeOperacionCuotaCategoria =
            backendMessage ||
            `Error al eliminar cuotas por categoría para el período ${fechaIsoInicio} - ${fechaIsoFin}.`;

          this.tipoOperacionCuotaCategoria = 'error';
          this.cd.detectChanges();
        },
      });
  }

  // ─────────────────────────────────────────────
  // Eliminar cuotas de vendedor (mensual + semanal + diaria)
  // ─────────────────────────────────────────────

  get nombresVendedoresCuotaSeleccionados(): string {
    if (this.seleccionarTodosVendedoresCuota) {
      return `todos los vendedores (${this.vendedores.length})`;
    }

    const nombres = this.vendedores
      .filter((v) =>
        this.idsUsuariosCuotaVendedor.some(
          (id) => String(id) === String(v?.id_usuario ?? v?.id),
        ),
      )
      .map((v) => v?.nombre ?? v?.username ?? 'vendedor');

    return nombres.length ? nombres.join(', ') : 'vendedor seleccionado';
  }

  get resumenSeleccionVendedoresCuota(): string {
    if (this.seleccionarTodosVendedoresCuota) {
      return `Todos los vendedores (${this.vendedores.length})`;
    }

    const cantidad = this.idsUsuariosCuotaVendedor.length;

    if (cantidad === 0) {
      return 'Seleccione uno o varios vendedores';
    }

    if (cantidad === 1) {
      return this.nombresVendedoresCuotaSeleccionados;
    }

    return `${cantidad} vendedores seleccionados`;
  }

  onToggleVendedorSelectorAbierto(event: Event): void {
    this.vendedorSelectorAbierto = (event.target as HTMLDetailsElement).open;
  }

  get periodoCuotaVendedorSeleccionado(): string {
    if (!this.fechaInicioCuotaVendedor || !this.fechaFinCuotaVendedor) {
      return 'todo el histórico';
    }

    return `${this.fechaInicioCuotaVendedor} - ${this.fechaFinCuotaVendedor}`;
  }

  onCambiarFiltroEliminarCuotaVendedor(): void {
    this.mensajeOperacionCuotaVendedor = null;
    this.tipoOperacionCuotaVendedor = null;
    this.cd.detectChanges();
  }

  onToggleSeleccionarTodosVendedoresCuota(): void {
    this.onCambiarFiltroEliminarCuotaVendedor();

    this.idsUsuariosCuotaVendedor = [];
    this.cuotasMesVendedor = [];
    this.cuotasSemanaVendedor = [];
    this.cuotasDiaVendedor = [];
    this.cd.detectChanges();
  }

  onToggleVendedorCuota(vendedor: any): void {
    if (this.seleccionarTodosVendedoresCuota) return;

    this.onCambiarFiltroEliminarCuotaVendedor();

    const id = vendedor?.id_usuario ?? vendedor?.id;
    const idx = this.idsUsuariosCuotaVendedor.findIndex((v) => String(v) === String(id));

    if (idx >= 0) {
      this.idsUsuariosCuotaVendedor.splice(idx, 1);
    } else {
      this.idsUsuariosCuotaVendedor.push(id);
    }

    this.cuotasMesVendedor = [];
    this.cuotasSemanaVendedor = [];
    this.cuotasDiaVendedor = [];

    if (this.idsUsuariosCuotaVendedor.length === 1) {
      this.cargarHistoricoCuotasVendedor(this.idsUsuariosCuotaVendedor[0]);
    } else {
      this.cd.detectChanges();
    }
  }

  estaVendedorCuotaSeleccionado(vendedor: any): boolean {
    const id = vendedor?.id_usuario ?? vendedor?.id;
    return this.idsUsuariosCuotaVendedor.some((v) => String(v) === String(id));
  }

  private cargarHistoricoCuotasVendedor(idUsuario: string | number): void {
    this.cargandoHistoricoCuotas = true;
    this.cd.detectChanges();

    this.cuotasCrudService.listarCuotaMesPorVendedor(idUsuario).subscribe((res) => {
      this.cuotasMesVendedor = res;
      this.cd.detectChanges();
    });

    this.cuotasCrudService.listarCuotaSemanaPorVendedor(idUsuario).subscribe((res) => {
      this.cuotasSemanaVendedor = res;
      this.cd.detectChanges();
    });

    this.cuotasCrudService.listarCuotaDiaPorVendedor(idUsuario).subscribe((res) => {
      this.cuotasDiaVendedor = res;
      this.cargandoHistoricoCuotas = false;
      this.cd.detectChanges();
    });
  }

  eliminarCuotaIndividual(tipo: 'mes' | 'semana' | 'dia', cuota: CuotaRegistro): void {
    const etiqueta = tipo === 'mes' ? 'mensual' : tipo === 'semana' ? 'semanal' : 'diaria';

    if (
      !confirm(
        `¿Seguro que deseas eliminar la cuota ${etiqueta} del período ${cuota.fecha_inicio ?? '—'} a ${cuota.fecha_fin ?? '—'}?`,
      )
    ) {
      return;
    }

    this.eliminandoCuotaIndividualId = cuota.id;
    this.cd.detectChanges();

    const eliminar$ =
      tipo === 'mes'
        ? this.cuotasCrudService.eliminarCuotaMes(cuota.id)
        : tipo === 'semana'
          ? this.cuotasCrudService.eliminarCuotaSemana(cuota.id)
          : this.cuotasCrudService.eliminarCuotaDia(cuota.id);

    eliminar$.subscribe({
      next: () => {
        this.eliminandoCuotaIndividualId = null;

        if (tipo === 'mes') {
          this.cuotasMesVendedor = this.cuotasMesVendedor.filter((c) => c.id !== cuota.id);
        } else if (tipo === 'semana') {
          this.cuotasSemanaVendedor = this.cuotasSemanaVendedor.filter((c) => c.id !== cuota.id);
        } else {
          this.cuotasDiaVendedor = this.cuotasDiaVendedor.filter((c) => c.id !== cuota.id);
        }

        this.mensajeOperacionCuotaVendedor = `Cuota ${etiqueta} eliminada correctamente.`;
        this.tipoOperacionCuotaVendedor = 'success';
        this.cd.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.eliminandoCuotaIndividualId = null;
        this.mensajeOperacionCuotaVendedor =
          this.extraerMensajeError(err) || `Error al eliminar la cuota ${etiqueta}.`;
        this.tipoOperacionCuotaVendedor = 'error';
        this.cd.detectChanges();
      },
    });
  }

  openConfirmEliminarCuotaVendedor(): void {
    if (!this.seleccionarTodosVendedoresCuota && this.idsUsuariosCuotaVendedor.length === 0) {
      this.mensajeOperacionCuotaVendedor = 'Seleccione al menos un vendedor.';
      this.tipoOperacionCuotaVendedor = 'error';
      this.cd.detectChanges();
      return;
    }

    const tieneAlgunaFecha = !!this.fechaInicioCuotaVendedor || !!this.fechaFinCuotaVendedor;
    const tieneAmbasFechas = !!this.fechaInicioCuotaVendedor && !!this.fechaFinCuotaVendedor;

    if (tieneAlgunaFecha && !tieneAmbasFechas) {
      this.mensajeOperacionCuotaVendedor =
        'Seleccione fecha inicio y fecha fin, o deje ambas vacías para eliminar todo el histórico.';
      this.tipoOperacionCuotaVendedor = 'error';
      this.cd.detectChanges();
      return;
    }

    if (
      tieneAmbasFechas &&
      !this.esRangoFechasValido(this.fechaInicioCuotaVendedor!, this.fechaFinCuotaVendedor!)
    ) {
      this.mensajeOperacionCuotaVendedor = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacionCuotaVendedor = 'error';
      this.cd.detectChanges();
      return;
    }

    this.mensajeOperacionCuotaVendedor = null;
    this.tipoOperacionCuotaVendedor = null;
    this.confirmInputCuotaVendedor = '';
    this.showConfirmCuotaVendedorModal = true;
    this.cd.detectChanges();
  }

  closeConfirmCuotaVendedor(): void {
    if (this.eliminandoCuotaVendedor) return;

    this.showConfirmCuotaVendedorModal = false;
    this.confirmInputCuotaVendedor = '';
    this.cd.detectChanges();
  }

  finalDeleteCuotaVendedor(): void {
    if (this.confirmInputCuotaVendedor !== 'ELIMINAR') {
      return;
    }

    const ids = this.seleccionarTodosVendedoresCuota
      ? this.vendedores.map((v) => v?.id_usuario ?? v?.id)
      : this.idsUsuariosCuotaVendedor;

    if (ids.length === 0) {
      return;
    }

    this.eliminandoCuotaVendedor = true;
    this.mensajeOperacionCuotaVendedor = null;
    this.tipoOperacionCuotaVendedor = null;
    this.cd.detectChanges();

    const onExito = (mensaje: string) => {
      this.eliminandoCuotaVendedor = false;
      this.showConfirmCuotaVendedorModal = false;
      this.confirmInputCuotaVendedor = '';
      this.mensajeOperacionCuotaVendedor = mensaje;
      this.tipoOperacionCuotaVendedor = 'success';
      this.cd.detectChanges();
    };

    const onError = (err: HttpErrorResponse) => {
      this.eliminandoCuotaVendedor = false;
      this.showConfirmCuotaVendedorModal = false;
      this.confirmInputCuotaVendedor = '';
      this.mensajeOperacionCuotaVendedor =
        this.extraerMensajeError(err) || 'Error al eliminar las cuotas del vendedor.';
      this.tipoOperacionCuotaVendedor = 'error';
      this.cd.detectChanges();
    };

    if (ids.length === 1) {
      this.cuotasUploadService
        .eliminarCuotasVendedor(ids[0], this.fechaInicioCuotaVendedor, this.fechaFinCuotaVendedor)
        .subscribe({
          next: (res: any) =>
            onExito(res?.message ?? 'Cuotas del vendedor eliminadas correctamente.'),
          error: onError,
        });
      return;
    }

    this.cuotasUploadService
      .eliminarCuotasVendedoresLote(ids, this.fechaInicioCuotaVendedor, this.fechaFinCuotaVendedor)
      .subscribe({
        next: (res: any) =>
          onExito(res?.message ?? `Cuotas eliminadas correctamente para ${ids.length} vendedores.`),
        error: onError,
      });
  }

  // ─────────────────────────────────────────────
  // Editar cuotas de vendedor (mensual + semanal + diaria)
  // ─────────────────────────────────────────────

  get etiquetaTipoCuotaEditar(): string {
    return this.tipoCuotaEditar === 'mes'
      ? 'mensual'
      : this.tipoCuotaEditar === 'semana'
        ? 'semanal'
        : this.tipoCuotaEditar === 'categoria'
          ? 'de categoría'
          : this.tipoCuotaEditar === 'proveedor'
            ? 'de proveedor'
            : this.tipoCuotaEditar === 'impacto_cliente'
              ? 'de impactos por cliente'
              : this.tipoCuotaEditar === 'impacto_proveedor'
                ? 'de impactos por proveedor'
                : this.tipoCuotaEditar === 'impacto_categoria'
                  ? 'de impactos por categoría'
                  : 'diaria';
  }

  get vendedorSeleccionadoEditar(): any {
    return this.vendedores.find(
      (v) => String(v?.id_usuario ?? v?.id) === String(this.idUsuarioEditar),
    );
  }

  get filtroFechasEditarValido(): boolean {
    if (!this.fechaInicioEditar || !this.fechaFinEditar) return true;
    return this.esRangoFechasValido(this.fechaInicioEditar, this.fechaFinEditar);
  }

  get cuotasEditarFiltradas(): CuotaRegistro[] {
    if (!this.filtroFechasEditarValido) return [];

    const inicio = this.fechaInicioEditar;
    const fin = this.fechaFinEditar;

    let resultado = this.cuotasEditar;

    if (inicio || fin) {
      resultado = resultado.filter((c) => {
        if (!c.fecha_inicio || !c.fecha_fin) return true;
        if (inicio && c.fecha_fin < inicio) return false;
        if (fin && c.fecha_inicio > fin) return false;
        return true;
      });
    }

    if (this.tipoCuotaEditar === 'proveedor') {
      const busqueda = this.busquedaProveedorEditar.trim().toLowerCase();
      if (busqueda) {
        resultado = resultado.filter((c) =>
          String(c.nombreProveedor ?? '')
            .toLowerCase()
            .includes(busqueda),
        );
      }
    }

    return resultado;
  }

  onCambiarVendedorEditar(): void {
    this.mensajeOperacionEditar = null;
    this.tipoOperacionEditar = null;
    this.editandoCuotaId = null;
    this.valorEditado = null;
    this.busquedaProveedorEditar = '';
    this.cargarCuotasEditar();
  }

  onCambiarTipoCuotaEditar(): void {
    this.mensajeOperacionEditar = null;
    this.tipoOperacionEditar = null;
    this.editandoCuotaId = null;
    this.valorEditado = null;
    this.busquedaProveedorEditar = '';
    this.cargarCuotasEditar();
  }

  onCambiarFiltroEditar(): void {
    this.mensajeOperacionEditar = null;
    this.tipoOperacionEditar = null;
    this.cd.detectChanges();
  }

  private cargarCuotasEditar(): void {
    if (!this.idUsuarioEditar) {
      this.cuotasEditar = [];
      this.cd.detectChanges();
      return;
    }

    if (this.tipoCuotaEditar === 'categoria' || this.tipoCuotaEditar === 'proveedor') {
      const idVendedor = this.vendedorSeleccionadoEditar?.id_vendedor;

      if (!idVendedor) {
        this.cuotasEditar = [];
        this.cargandoCuotasEditar = false;
        this.cd.detectChanges();
        return;
      }

      this.cargandoCuotasEditar = true;
      this.cuotasEditar = [];
      this.cd.detectChanges();

      const listar$ =
        this.tipoCuotaEditar === 'categoria'
          ? this.cuotasCrudService.listarCuotaCategoriaPorVendedor(idVendedor)
          : this.cuotasCrudService.listarCuotaProveedorPorVendedor(idVendedor);

      listar$.subscribe((res) => {
        this.cuotasEditar = res;
        this.cargandoCuotasEditar = false;
        this.cd.detectChanges();
      });
      return;
    }

    if (
      this.tipoCuotaEditar === 'impacto_cliente' ||
      this.tipoCuotaEditar === 'impacto_proveedor' ||
      this.tipoCuotaEditar === 'impacto_categoria'
    ) {
      const tipoApi: 'clientes' | 'categorias' | 'proveedores' =
        this.tipoCuotaEditar === 'impacto_cliente'
          ? 'clientes'
          : this.tipoCuotaEditar === 'impacto_proveedor'
            ? 'proveedores'
            : 'categorias';

      const codigoVendedor = this.vendedorSeleccionadoEditar?.codigo_vendedor;

      this.cargandoCuotasEditar = true;
      this.cuotasEditar = [];
      this.cd.detectChanges();

      this.cuotasCrudService.listarImpactos(tipoApi, { vendedor: codigoVendedor }).subscribe({
        next: (res: any) => {
          this.cuotasEditar = (res.data ?? []).map((i: any) => ({
            id: i.id,
            monto: i.cuota,
            fecha_inicio: i.fecha_inicio,
            fecha_fin: i.fecha_fin,
            id_usuario: i.id_vendedor,
            _tipoPeriodo: i.tipo_periodo,
            _codigoVendedor: i.codigo_vendedor,
            _nombreVendedor: i.nombre_vendedor,
            _nombreCategoria: i.nombre_categoria,
            _nombreProveedor: i.nombre_proveedor,
          }));
          this.cargandoCuotasEditar = false;
          this.cd.detectChanges();
        },
        error: () => {
          this.cuotasEditar = [];
          this.cargandoCuotasEditar = false;
          this.cd.detectChanges();
        },
      });
      return;
    }

    this.cargandoCuotasEditar = true;
    this.cuotasEditar = [];
    this.cd.detectChanges();

    const listar$ =
      this.tipoCuotaEditar === 'mes'
        ? this.cuotasCrudService.listarCuotaMesPorVendedor(this.idUsuarioEditar)
        : this.tipoCuotaEditar === 'semana'
          ? this.cuotasCrudService.listarCuotaSemanaPorVendedor(this.idUsuarioEditar)
          : this.cuotasCrudService.listarCuotaDiaPorVendedor(this.idUsuarioEditar);

    listar$.subscribe((res) => {
      this.cuotasEditar = res;
      this.cargandoCuotasEditar = false;
      this.cd.detectChanges();
    });
  }

  iniciarEdicion(cuota: CuotaRegistro): void {
    if (this.guardandoCuotaId !== null) return;

    this.editandoCuotaId = cuota.id;
    this.valorEditado = cuota.monto ?? 0;
    this.mensajeOperacionEditar = null;
    this.tipoOperacionEditar = null;
    this.cd.detectChanges();
  }

  cancelarEdicion(): void {
    this.editandoCuotaId = null;
    this.valorEditado = null;
    this.cd.detectChanges();
  }

  puedeGuardarEdicion(cuota: CuotaRegistro): boolean {
    if (this.valorEditado === null || this.valorEditado === undefined) return false;

    const valor = Number(this.valorEditado);
    if (Number.isNaN(valor)) return false;

    const esImpacto =
      this.tipoCuotaEditar === 'impacto_cliente' ||
      this.tipoCuotaEditar === 'impacto_proveedor' ||
      this.tipoCuotaEditar === 'impacto_categoria';

    if (!esImpacto && valor < 0) return false;

    return valor !== Number(cuota.monto);
  }

  guardarEdicion(cuota: CuotaRegistro): void {
    if (this.guardandoCuotaId !== null) return;

    const valor = Number(this.valorEditado);
    const esImpacto =
      this.tipoCuotaEditar === 'impacto_cliente' ||
      this.tipoCuotaEditar === 'impacto_proveedor' ||
      this.tipoCuotaEditar === 'impacto_categoria';

    if (Number.isNaN(valor) || (!esImpacto && valor < 0)) {
      this.mensajeOperacionEditar = 'El nuevo valor debe ser un número mayor o igual a 0.';
      this.tipoOperacionEditar = 'error';
      this.cd.detectChanges();
      return;
    }

    this.guardandoCuotaId = cuota.id;
    this.mensajeOperacionEditar = null;
    this.tipoOperacionEditar = null;
    this.cd.detectChanges();

    const actualizar$ =
      this.tipoCuotaEditar === 'mes'
        ? this.cuotasCrudService.actualizarCuotaMes(cuota.id, valor)
        : this.tipoCuotaEditar === 'semana'
          ? this.cuotasCrudService.actualizarCuotaSemana(cuota.id, valor)
          : this.tipoCuotaEditar === 'categoria'
            ? this.cuotasCrudService.actualizarCuotaCategoria(cuota.id, valor)
            : this.tipoCuotaEditar === 'proveedor'
              ? this.cuotasCrudService.actualizarCuotaProveedor(cuota.id, valor)
              : this.tipoCuotaEditar === 'impacto_cliente'
                ? this.cuotasCrudService.actualizarImpacto('clientes', cuota.id, valor)
                : this.tipoCuotaEditar === 'impacto_proveedor'
                  ? this.cuotasCrudService.actualizarImpacto('proveedores', cuota.id, valor)
                  : this.tipoCuotaEditar === 'impacto_categoria'
                    ? this.cuotasCrudService.actualizarImpacto('categorias', cuota.id, valor)
                    : this.cuotasCrudService.actualizarCuotaDia(cuota.id, valor);

    actualizar$.subscribe({
      next: (res: any) => {
        const campo =
          this.tipoCuotaEditar === 'mes'
            ? 'cuota_mes'
            : this.tipoCuotaEditar === 'semana'
              ? 'cuota_semana'
              : this.tipoCuotaEditar === 'categoria'
                ? 'cuota'
                : this.tipoCuotaEditar === 'proveedor'
                  ? 'cuotaProveedor'
                  : this.tipoCuotaEditar.startsWith('impacto_')
                    ? 'cuota'
                    : 'cuota_dia';

        const nuevoValor =
          this.tipoCuotaEditar === 'proveedor'
            ? Number(res?.data?.cuotaProveedor?.cuota ?? valor)
            : Number(res?.data?.[campo] ?? valor);

        this.cuotasEditar = this.cuotasEditar.map((c) =>
          c.id === cuota.id ? { ...c, monto: nuevoValor } : c,
        );

        this.guardandoCuotaId = null;
        this.editandoCuotaId = null;
        this.valorEditado = null;
        this.mensajeOperacionEditar =
          res?.message ?? `Cuota ${this.etiquetaTipoCuotaEditar} actualizada correctamente.`;
        this.tipoOperacionEditar = 'success';
        this.cd.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoCuotaId = null;
        this.mensajeOperacionEditar =
          this.extraerMensajeError(err) ||
          `Error al actualizar la cuota ${this.etiquetaTipoCuotaEditar}.`;
        this.tipoOperacionEditar = 'error';
        this.cd.detectChanges();
      },
    });
  }

  private parseInputDateToIso(val: string | null): string | null {
    if (!val) return null;

    const v = val.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/;

    if (iso.test(v)) return v;

    return null;
  }

  private esRangoFechasValido(fechaInicio: string, fechaFin: string): boolean {
    return fechaInicio <= fechaFin;
  }

  private extraerMensajeError(err: HttpErrorResponse): string {
    if (typeof err.error === 'string') {
      return err.error;
    }

    return err.error?.mensaje ?? err.error?.message ?? err.error?.error ?? err.message ?? '';
  }
}