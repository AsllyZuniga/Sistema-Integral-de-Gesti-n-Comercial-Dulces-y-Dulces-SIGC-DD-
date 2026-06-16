import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { AuthService } from '../../../core/services/auth.service';

import { CuotaVendedorUploadComponent } from './cuota-vendedor-upload/cuota-vendedor-upload.component';
import { CuotaProveedorUploadComponent } from './cuota-proveedor-upload/cuota-proveedor-upload.component';
import { CuotaCategoriaUploadComponent } from './cuota-categoria-upload/cuota-categoria-upload.component';

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
  ],
  templateUrl: './carga-cuotas.component.html',
  styleUrls: ['./carga-cuotas.component.css'],
})
export class CargaCuotasComponent {
  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  sidebarColapsado = false;

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

  constructor(
    private cd: ChangeDetectorRef,
    private auth: AuthService,
    private cuotasUploadService: CuotasUploadService,
  ) {}

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