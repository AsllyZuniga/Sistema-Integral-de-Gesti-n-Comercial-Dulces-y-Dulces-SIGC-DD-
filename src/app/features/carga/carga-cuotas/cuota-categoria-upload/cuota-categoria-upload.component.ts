import { Component, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CuotasUploadResponse,
  CuotasUploadService,
} from '../../../../core/services/cuotas-upload.service';

type EstadoCarga = 'idle' | 'cargando' | 'exito' | 'error';

@Component({
  selector: 'app-cuota-categoria-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cuota-section">
      <h3>Cuota por Categoría</h3>
      <p class="section-desc">
        Carga el archivo CSV con cuotas por categoría de producto.
      </p>

      <div class="upload-card">
        <!-- ZONA DE CARGA -->
        <div
          class="upload-zone"
          [class.has-file]="archivoSeleccionado"
          [class.is-loading]="estaImportando"
          (click)="onClickZonaCarga()"
        >
          <input
            type="file"
            accept=".csv,.txt"
            style="display: none"
            (change)="onArchivoSeleccionado($event)"
            #fileInput
          />

          @if (!archivoSeleccionado) {
            <span class="material-symbols-rounded upload-icon">upload_file</span>
            <p class="upload-text">Seleccionar archivo CSV</p>
            <p class="upload-hint">Formato: <strong>Categoría, Cuota</strong></p>
          } @else {
            <span class="material-symbols-rounded upload-icon file-ready">task</span>
            <p class="upload-text">{{ archivoSeleccionado.name }}</p>
            <p class="upload-hint">{{ tamanioMB }} MB · Listo para importar</p>
          }
        </div>

        <!-- ACCIONES -->
        <div class="upload-actions">
          @if (archivoSeleccionado && !estaImportando) {
            <button class="btn-limpiar" (click)="limpiar()">
              <span class="material-symbols-rounded">close</span>
              Limpiar
            </button>
          }
          <button
            class="btn-cargar"
            [disabled]="!archivoSeleccionado || estaImportando"
            (click)="cargar()"
          >
            @if (estaImportando) {
              <span class="spinner"></span>
              Importando...
            } @else {
              <span class="material-symbols-rounded">cloud_upload</span>
              Importar
            }
          </button>
        </div>

        <!-- RESULTADO -->
        @if (estado === 'exito' && resultado) {
          <div class="resultado exito">
            <span class="material-symbols-rounded">check_circle</span>
            <div class="resultado-info">
              <h4>Importación exitosa</h4>
              <p class="resultado-msg">{{ resultado.message }}</p>
            </div>
          </div>
        }

        @if (estado === 'error') {
          <div class="resultado error">
            <span class="material-symbols-rounded">error</span>
            <div class="resultado-info">
              <h4>Error en importación</h4>
              <p class="resultado-msg">{{ mensajeError }}</p>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .cuota-section {
        margin-bottom: 32px;
        padding: 24px;
        background: var(--c-card);
        border-radius: 12px;
        border: 1px solid var(--c-border);
      }

      h3 {
        margin: 0 0 8px;
        font-size: 16px;
        font-weight: 700;
        color: var(--c-text);
      }

      .section-desc {
        margin: 0 0 16px;
        font-size: 13px;
        color: var(--c-text-muted);
      }

      .upload-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .upload-zone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 32px 24px;
        border: 2px dashed var(--c-border);
        border-radius: 8px;
        background: var(--c-bg-alt);
        cursor: pointer;
        transition: all 0.2s;
      }

      .upload-zone:hover {
        border-color: var(--c-primary);
        background: rgba(37, 99, 235, 0.02);
      }

      .upload-zone.has-file {
        border-color: var(--c-success);
        background: rgba(22, 163, 74, 0.02);
      }

      .upload-zone.is-loading {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .upload-icon {
        font-size: 32px;
        color: var(--c-text-muted);
      }

      .upload-icon.file-ready {
        color: var(--c-success);
      }

      .upload-text {
        margin: 0;
        font-weight: 600;
        font-size: 14px;
        color: var(--c-text);
      }

      .upload-hint {
        margin: 0;
        font-size: 12px;
        color: var(--c-text-muted);
      }

      .upload-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .btn-limpiar,
      .btn-cargar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid var(--c-border);
        border-radius: 6px;
        background: var(--c-card);
        color: var(--c-text);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-limpiar:hover {
        border-color: var(--c-danger);
        background: rgba(239, 68, 68, 0.05);
        color: var(--c-danger);
      }

      .btn-cargar {
        border-color: var(--c-primary);
        background: var(--c-primary);
        color: white;
      }

      .btn-cargar:hover:not(:disabled) {
        background: #1d4ed8;
      }

      .btn-cargar:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .resultado {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 13px;
      }

      .resultado.exito {
        background: rgba(22, 163, 74, 0.1);
        color: var(--c-success);
        border: 1px solid rgba(22, 163, 74, 0.3);
      }

      .resultado.error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--c-danger);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .resultado-info h4 {
        margin: 0 0 4px;
        font-size: 13px;
        font-weight: 700;
      }

      .resultado-msg {
        margin: 0;
        font-size: 12px;
        opacity: 0.9;
      }
    `,
  ],
})
export class CuotaCategoriaUploadComponent {
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  archivoSeleccionado: File | null = null;
  estado: EstadoCarga = 'idle';
  resultado: CuotasUploadResponse | null = null;
  mensajeError = '';

  get estaImportando(): boolean {
    return this.estado === 'cargando';
  }

  get tamanioMB(): string {
    if (!this.archivoSeleccionado) return '';
    return (this.archivoSeleccionado.size / 1024 / 1024).toFixed(2);
  }

  constructor(
    private cuotasService: CuotasUploadService,
    private cd: ChangeDetectorRef,
  ) {}

  onArchivoSeleccionado(event: Event): void {
    if (this.estaImportando) return;

    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const archivo = input.files[0];
    input.value = '';

    if (!archivo.name.toLowerCase().match(/\.(csv|txt)$/)) {
      this.setError('Solo se aceptan archivos .csv o .txt');
      return;
    }

    this.archivoSeleccionado = archivo;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
    this.cd.detectChanges();
  }

  onClickZonaCarga(): void {
    if (this.estaImportando) return;
    this.fileInputRef?.nativeElement.click();
  }

  cargar(): void {
    if (!this.archivoSeleccionado || this.estaImportando) return;

    this.estado = 'cargando';
    this.resultado = null;
    this.mensajeError = '';
    this.cd.detectChanges();

    this.cuotasService.uploadCuotasCategoria(this.archivoSeleccionado).subscribe({
      next: (res: CuotasUploadResponse) => {
        this.estado = 'exito';
        this.resultado = res;
        this.archivoSeleccionado = null;
        this.cd.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        const backendMessage =
          typeof err.error === 'string'
            ? err.error
            : (err.error?.message ?? err.error?.error);
        this.setError(backendMessage || err.message || 'Error al importar cuotas');
        this.estado = 'error';
        this.cd.detectChanges();
      },
    });
  }

  limpiar(): void {
    this.archivoSeleccionado = null;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
    this.cd.detectChanges();
  }

  private setError(msg: string): void {
    this.mensajeError = msg;
    this.estado = 'error';
  }
}
