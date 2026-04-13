import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { SessionService } from '../../../core/services/session.service';
import { environment } from '../../../../environments/environment';

type EstadoCarga = 'idle' | 'cargando' | 'exito' | 'error';
type TipoError = 'formato' | 'columnas' | 'datos' | 'servidor' | 'desconocido';

interface ImportVentasResponse {
  status?: 'error' | 'completado' | 'exito';
  mensaje?: string;
  error?: string;
  exitosas?: number;
  errores?: number;
  registrosExitosos?: number;
  registrosConError?: number;
  tiempoInicio?: number;
  tiempoFin?: number;
  tiempoTotalSegundos?: number | string;
}

@Component({
  selector: 'app-carga',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './carga.component.html',
  styleUrls: ['./carga.component.css'],
})
export class CargaComponent {
  private readonly apiUrl = environment.apiUrl;

  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  // Sales upload properties
  archivoSeleccionado: File | null = null;
  isDragOver = false;
  estado: EstadoCarga = 'idle';
  resultado: ImportVentasResponse | null = null;
  mensajeError = '';
  tipoError: TipoError | null = null;
  sidebarColapsado = false;

  get registrosExitosos(): number {
    return this.resultado?.exitosas ?? this.resultado?.registrosExitosos ?? 0;
  }

  get registrosConError(): number {
    return this.resultado?.errores ?? this.resultado?.registrosConError ?? 0;
  }

  get tiempoTotal(): string {
    if (!this.resultado) return '—';
    if (this.resultado.tiempoInicio && this.resultado.tiempoFin) {
      return ((this.resultado.tiempoFin - this.resultado.tiempoInicio) / 1000).toFixed(2);
    }
    if (this.resultado.tiempoTotalSegundos !== undefined) {
      return String(this.resultado.tiempoTotalSegundos);
    }
    return '—';
  }

  get tamanioMB(): string {
    if (!this.archivoSeleccionado) return '';
    return (this.archivoSeleccionado.size / 1024 / 1024).toFixed(2);
  }

  get estaImportando(): boolean {
    return this.estado === 'cargando';
  }

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private session: SessionService,
  ) {}

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const archivo = input.files[0];
    input.value = '';

    this.procesarArchivo(archivo);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.estaImportando) return;
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDropArchivo(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (this.estaImportando) return;

    const archivo = event.dataTransfer?.files?.[0];
    if (!archivo) return;

    this.procesarArchivo(archivo);
  }

  private procesarArchivo(archivo: File): void {
    if (this.estaImportando) return;

    if (!archivo.name.toLowerCase().endsWith('.txt')) {
      this.setError('formato', 'Solo se aceptan archivos .txt exportados desde el ERP.');
      return;
    }

    this.archivoSeleccionado = archivo;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
    this.tipoError = null;
    this.cd.detectChanges();
  }

  onClickZonaCarga(): void {
    // Bloquear apertura del selector mientras importa
    if (this.estaImportando) return;
    document.getElementById('fileInput')?.click();
  }

  cargar(): void {
    if (!this.archivoSeleccionado || this.estaImportando) return;

    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);
    formData.append('batchSize', '10000');

    this.estado = 'cargando';
    this.resultado = null;
    this.mensajeError = '';
    this.tipoError = null;
    this.cd.detectChanges();

    this.http
      .post(`${this.apiUrl}/import/ventas/upload`, formData, {
        responseType: 'text',
        observe: 'response',
      })
      .subscribe({
        next: (response) => {
          const textoRespuesta = response.body ?? '';
          const jsons = this.parsearJsonsConcatenados(textoRespuesta);

          if (jsons.length === 0) {
            this.setError(
              'servidor',
              'El servidor no devolvió una respuesta válida. Intenta nuevamente.',
            );
            return;
          }

          const ultimoJson = jsons[jsons.length - 1];

          if (ultimoJson.status === 'error') {
            const { tipo, mensaje } = this.clasificarError(
              ultimoJson.mensaje ?? ultimoJson.error ?? '',
            );
            this.setError(tipo, mensaje);
            return;
          }

          if (
            ultimoJson.status === 'completado' ||
            ultimoJson.status === 'exito' ||
            ultimoJson.exitosas !== undefined
          ) {
            this.estado = 'exito';
            this.resultado = ultimoJson;
            this.tipoError = null;
            this.cd.detectChanges();
            return;
          }

          this.setError('desconocido', ultimoJson.mensaje ?? 'Respuesta inesperada del servidor.');
        },
        error: (err: HttpErrorResponse) => {
          if (typeof err.error === 'string') {
            const jsons = this.parsearJsonsConcatenados(err.error);
            if (jsons.length > 0) {
              const ultimoJson = jsons[jsons.length - 1];
              const { tipo, mensaje } = this.clasificarError(
                ultimoJson.mensaje ?? ultimoJson.error ?? '',
              );
              this.setError(tipo, mensaje);
              return;
            }
          }

          this.setError(
            'servidor',
            err?.error?.mensaje ??
              err?.error?.message ??
              err?.message ??
              'No se pudo conectar con el servidor.',
          );
        },
      });
  }

  limpiar(): void {
    if (this.estaImportando) return;
    this.archivoSeleccionado = null;
    this.isDragOver = false;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
    this.tipoError = null;
    this.cd.detectChanges();
  }

  onToggleSidebar(colapsado: boolean): void {
    this.sidebarColapsado = colapsado;
    this.cd.detectChanges();
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  logout(): void {
    this.session.clearUser();
    window.location.href = '/login';
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  private setError(tipo: TipoError, mensaje: string): void {
    this.estado = 'error';
    this.tipoError = tipo;
    this.mensajeError = mensaje;
    this.cd.detectChanges();
  }

  private clasificarError(mensajeOriginal: string): { tipo: TipoError; mensaje: string } {
    const msg = mensajeOriginal.toLowerCase();

    if (msg.includes('faltan columnas') || msg.includes('columnas requeridas')) {
      return {
        tipo: 'columnas',
        mensaje:
          'El archivo no tiene las columnas requeridas. Verifica que sea el plano de ventas correcto exportado desde el ERP.',
      };
    }

    if (
      msg.includes('formato') ||
      msg.includes('separador') ||
      msg.includes('tabulacion') ||
      msg.includes('encoding') ||
      msg.includes('parse')
    ) {
      return {
        tipo: 'formato',
        mensaje:
          'El archivo no tiene el formato correcto. Debe ser un .txt separado por tabulaciones exportado desde el ERP.',
      };
    }

    if (
      msg.includes('fecha') ||
      msg.includes('numero') ||
      msg.includes('número') ||
      msg.includes('valor inv')
    ) {
      return {
        tipo: 'datos',
        mensaje:
          'El archivo contiene datos con formato incorrecto. Revisa los valores antes de importar.',
      };
    }

    if (
      msg.includes('database') ||
      msg.includes('connection') ||
      msg.includes('timeout') ||
      msg.includes('sql')
    ) {
      return {
        tipo: 'servidor',
        mensaje: 'Error interno del servidor. Contacta al administrador del sistema.',
      };
    }

    return {
      tipo: 'desconocido',
      mensaje:
        mensajeOriginal.length > 200 ? mensajeOriginal.substring(0, 200) + '...' : mensajeOriginal,
    };
  }

  private parsearJsonsConcatenados(texto: string): ImportVentasResponse[] {
    const objetos: ImportVentasResponse[] = [];
    let profundidad = 0;
    let inicio = -1;

    for (let i = 0; i < texto.length; i++) {
      const char = texto[i];
      if (char === '{') {
        if (profundidad === 0) inicio = i;
        profundidad++;
      } else if (char === '}') {
        profundidad--;
        if (profundidad === 0 && inicio !== -1) {
          try {
            objetos.push(JSON.parse(texto.substring(inicio, i + 1)));
          } catch {}
          inicio = -1;
        }
      }
    }

    return objetos;
  }
}
