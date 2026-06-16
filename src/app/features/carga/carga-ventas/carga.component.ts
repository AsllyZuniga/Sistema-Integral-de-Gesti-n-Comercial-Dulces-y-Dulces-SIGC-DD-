import { Component, ViewChild, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpEventType, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../../shared/components/topbar/topbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { timeout } from 'rxjs/operators';

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
  imports: [CommonModule, FormsModule, SidebarComponent, TopbarComponent],
  templateUrl: './carga.component.html',
  styleUrls: ['./carga.component.css'],
})
export class CargaComponent implements OnDestroy {
  private readonly apiUrl = '/api';
  private readonly adminVentasUrl = '/api';

  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  archivoSeleccionado: File | null = null;
  isDragOver = false;
  estado: EstadoCarga = 'idle';
  resultado: ImportVentasResponse | null = null;
  mensajeError = '';
  tipoError: TipoError | null = null;
  sidebarColapsado = false;

  uploadProgress: number | null = null;
  processedLines: number | null = null;
  totalAcumulado: number | null = null;
  rawLog: string | null = null;
  showLogs = false;

  fechaInicio: string | null = null;
  fechaFin: string | null = null;

  cargandoPreview = false;
  previewResult: any = null;
  eliminando = false;
  mensajeOperacion: string | null = null;
  tipoOperacion: 'success' | 'error' | null = null;

  showConfirmModal = false;
  confirmInput = '';

  constructor(
    private http: HttpClient,
    private cd: ChangeDetectorRef,
    private auth: AuthService,
  ) {}

  get registrosExitosos(): number {
    return this.resultado?.exitosas ?? this.resultado?.registrosExitosos ?? 0;
  }

  get registrosConError(): number {
    return this.resultado?.errores ?? this.resultado?.registrosConError ?? 0;
  }

  get periodoSeleccionado(): string {
    if (!this.fechaInicio || !this.fechaFin) return 'periodo no seleccionado';
    return `${this.fechaInicio} - ${this.fechaFin}`;
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

  onCambiarFechaEliminar(): void {
    this.mensajeOperacion = null;
    this.tipoOperacion = null;
    this.previewResult = null;
    this.cd.detectChanges();
  }

  previewVentas(): void {
    const isoInicio = this.parseInputDateToIso(this.fechaInicio);
    const isoFin = this.parseInputDateToIso(this.fechaFin);

    if (!isoInicio || !isoFin) {
      this.mensajeOperacion = 'Seleccione fecha inicio y fecha fin para previsualizar.';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(isoInicio, isoFin)) {
      this.mensajeOperacion = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    this.cargandoPreview = true;
    this.previewResult = null;
    this.mensajeOperacion = null;
    this.tipoOperacion = null;
    this.cd.detectChanges();

    const params = new HttpParams().set('fechaInicio', isoInicio).set('fechaFin', isoFin);

    this.http.get(`${this.adminVentasUrl}/admin/ventas/preview`, { params }).subscribe({
      next: (res) => {
        this.previewResult = res;
        this.cargandoPreview = false;
        this.cd.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.cargandoPreview = false;

        if (err.status === 0) {
          this.mensajeOperacion =
            `No se pudo conectar con ${this.adminVentasUrl}/admin/ventas/preview. ` +
            'Verifica que el endpoint exista y que CORS permita la petición.';
        } else {
          const backendMessage =
            typeof err.error === 'string'
              ? err.error
              : (err.error?.mensaje ?? err.error?.message ?? err.error?.error);

          this.mensajeOperacion =
            backendMessage || err.message || 'Error al obtener previsualización.';
        }

        this.tipoOperacion = 'error';
        this.cd.detectChanges();
      },
    });
  }

  eliminarVentas(): void {
    this.openConfirmEliminar();
  }

  openConfirmEliminar(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicio);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFin);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.mensajeOperacion = 'Seleccione fecha inicio y fecha fin para eliminar ventas.';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.mensajeOperacion = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    this.mensajeOperacion = null;
    this.tipoOperacion = null;
    this.previewResult = null;
    this.confirmInput = '';
    this.showConfirmModal = true;
    this.cd.detectChanges();
  }

  closeConfirm(): void {
    if (this.eliminando) return;

    this.showConfirmModal = false;
    this.confirmInput = '';
    this.cd.detectChanges();
  }

  finalDelete(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicio);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFin);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.showConfirmModal = false;
      this.mensajeOperacion = 'Fechas inválidas. Use el formato YYYY-MM-DD.';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.showConfirmModal = false;
      this.mensajeOperacion = 'La fecha inicio no puede ser mayor que la fecha fin.';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    if (this.confirmInput !== 'ELIMINAR') {
      return;
    }

    this.eliminando = true;
    this.mensajeOperacion = null;
    this.tipoOperacion = null;
    this.cd.detectChanges();

    const params = new HttpParams().set('fechaInicio', fechaIsoInicio).set('fechaFin', fechaIsoFin);

    this.http
      .delete(`${this.adminVentasUrl}/admin/ventas`, {
        params,
        responseType: 'text',
      })
      .subscribe({
        next: (res: string) => {
          this.eliminando = false;
          this.showConfirmModal = false;
          this.confirmInput = '';
          this.previewResult = null;

          this.mensajeOperacion =
            this.formatearMensajeEliminacion(res, fechaIsoInicio, fechaIsoFin) ||
            `Se eliminaron las ventas del período ${this.formatearPeriodo(fechaIsoInicio, fechaIsoFin)}.`;

          this.tipoOperacion = 'success';
          this.cd.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.eliminando = false;
          this.showConfirmModal = false;
          this.confirmInput = '';

          if (err.status === 0) {
            this.mensajeOperacion =
              `No se pudo conectar con ${this.adminVentasUrl}/admin/ventas. ` +
              'Verifica que el backend esté encendido, que el endpoint exista en producción y que CORS permita DELETE.';
          } else {
            const backendMessage =
              typeof err.error === 'string'
                ? err.error
                : (err.error?.mensaje ?? err.error?.message ?? err.error?.error);

            this.mensajeOperacion = backendMessage || err.message || 'Error al eliminar ventas.';
          }

          this.tipoOperacion = 'error';
          this.cd.detectChanges();
        },
      });
  }

  private formatearPeriodo(fechaInicio: string, fechaFin: string): string {
    return `${fechaInicio} al ${fechaFin}`;
  }

  private formatearMensajeEliminacion(
    respuesta: string,
    fechaInicio: string,
    fechaFin: string,
  ): string | null {
    const texto = String(respuesta ?? '').trim();
    if (!texto) return null;

    const respuestaLimpia = this.intentarParsearJson(texto);
    const ventasEliminadas = this.extraerNumero(respuestaLimpia?.ventasEliminadas ?? respuestaLimpia?.deleted ?? respuestaLimpia?.eliminadas);
    const detallesEliminados = this.extraerNumero(respuestaLimpia?.detallesEliminados ?? respuestaLimpia?.affected);

    if ((ventasEliminadas ?? 0) === 0 && (detallesEliminados ?? 0) === 0) {
      return `No se encontraron ventas para eliminar en el período ${this.formatearPeriodo(fechaInicio, fechaFin)}.`;
    }

    if (ventasEliminadas !== null || detallesEliminados !== null) {
      const partes: string[] = [];
      if (ventasEliminadas !== null) {
        partes.push(`${ventasEliminadas} venta${ventasEliminadas === 1 ? '' : 's'}`);
      }
      if (detallesEliminados !== null) {
        partes.push(`${detallesEliminados} detalle${detallesEliminados === 1 ? '' : 's'}`);
      }

      return `Se eliminaron ${partes.join(' y ')} del período ${this.formatearPeriodo(fechaInicio, fechaFin)}.`;
    }

    if (typeof respuestaLimpia?.message === 'string' && respuestaLimpia.message.trim()) {
      return respuestaLimpia.message.trim();
    }

    if (typeof respuestaLimpia?.mensaje === 'string' && respuestaLimpia.mensaje.trim()) {
      return respuestaLimpia.mensaje.trim();
    }

    return texto.startsWith('{') || texto.startsWith('[')
      ? `Se eliminaron las ventas del período ${this.formatearPeriodo(fechaInicio, fechaFin)}.`
      : texto;
  }

  private intentarParsearJson(texto: string): any {
    if (!texto.startsWith('{') && !texto.startsWith('[')) return null;

    try {
      return JSON.parse(texto);
    } catch {
      return null;
    }
  }

  private extraerNumero(valor: unknown): number | null {
    const num = Number(valor);
    return Number.isFinite(num) ? num : null;
  }

  private parseInputDateToIso(val: string | null): string | null {
    if (!val) return null;

    const v = val.trim();

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
    const mmddyyyy = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})$/;

    if (iso.test(v)) return v;

    const m = mmddyyyy.exec(v);

    if (m) {
      const month = m[1].padStart(2, '0');
      const day = m[2].padStart(2, '0');
      const year = m[3];

      return `${year}-${month}-${day}`;
    }

    return null;
  }

  private esRangoFechasValido(fechaInicio: string, fechaFin: string): boolean {
    return fechaInicio <= fechaFin;
  }

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
    this.uploadProgress = 0;
    this.processedLines = null;
    this.totalAcumulado = null;
    this.rawLog = null;
    this.showLogs = false;
    this.cd.detectChanges();

    this.http
      .post(`${this.apiUrl}/import/ventas/upload`, formData, {
        responseType: 'text',
        observe: 'events',
        reportProgress: true,
      })
      .pipe(timeout(300000))
      .subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            const percent = event.total ? Math.round((100 * event.loaded) / event.total) : 0;
            this.uploadProgress = percent;
            this.cd.detectChanges();
            return;
          }

          if (event.type === HttpEventType.Response) {
            const textoRespuesta = event.body ?? '';
            this.rawLog = typeof textoRespuesta === 'string' ? textoRespuesta : null;

            const jsons = this.parsearJsonsConcatenados(textoRespuesta);

            if (jsons.length === 0) {
              const extra = this.parsearDatosDesdeTexto(textoRespuesta);

              if (extra) {
                this.estado = 'exito';
                this.resultado = extra;
                this.rawLog = this.rawLog ?? textoRespuesta ?? null;
                this.processedLines = extra.registrosExitosos ?? extra.registrosConError ?? null;

                const ta =
                  extra.tiempoTotalSegundos !== undefined && extra.tiempoTotalSegundos !== null
                    ? Number(extra.tiempoTotalSegundos)
                    : null;

                this.totalAcumulado = Number.isFinite(ta) ? ta : null;
                this.tipoError = null;
                this.uploadProgress = 100;
                this.cd.detectChanges();
                return;
              }

              const hayIndicadores =
                /Lectura completada|Lote confirmado|Detalles insertados|Procesando batch/i.test(
                  textoRespuesta,
                );

              if (hayIndicadores) {
                const fallback: ImportVentasResponse = {
                  mensaje: 'Proceso completado.',
                  registrosConError: 0,
                };

                const lectura = /Lectura completada:\s*([0-9,.]+)\s*l[ií]neas procesadas/i.exec(
                  textoRespuesta,
                );

                if (lectura) {
                  fallback.registrosExitosos = Number(lectura[1].replace(/[,\.]/g, ''));
                }

                const totalAc = /Total acumulado:\s*([0-9,.]+)/i.exec(textoRespuesta);

                if (totalAc) {
                  const val = Number(totalAc[1].replace(/[,\.]/g, ''));
                  fallback.registrosExitosos = fallback.registrosExitosos ?? val;
                  fallback.tiempoTotalSegundos = val;
                }

                this.estado = 'exito';
                this.resultado = fallback;
                this.rawLog = this.rawLog ?? textoRespuesta ?? null;
                this.processedLines = fallback.registrosExitosos ?? null;
                this.totalAcumulado =
                  typeof fallback.tiempoTotalSegundos === 'number'
                    ? fallback.tiempoTotalSegundos
                    : null;
                this.uploadProgress = 100;
                this.tipoError = null;
                this.cd.detectChanges();
                return;
              }

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
              this.uploadProgress = 100;
              this.cd.detectChanges();
              return;
            }

            this.setError(
              'desconocido',
              ultimoJson.mensaje ?? 'Respuesta inesperada del servidor.',
            );
          }
        },
        error: (err: HttpErrorResponse) => {
          const textoErr = typeof err.error === 'string' ? err.error : '';
          this.rawLog = this.rawLog ?? (typeof err.error === 'string' ? err.error : null);

          const jsons = textoErr ? this.parsearJsonsConcatenados(textoErr) : [];

          if (jsons.length > 0) {
            const ultimoJson = jsons[jsons.length - 1];
            const { tipo, mensaje } = this.clasificarError(
              ultimoJson.mensaje ?? ultimoJson.error ?? '',
            );
            this.setError(tipo, mensaje);
            return;
          }

          const extra = this.parsearDatosDesdeTexto(textoErr || (err.error as any) || '');

          if (extra) {
            this.estado = 'exito';
            this.resultado = extra;
            this.rawLog = this.rawLog ?? textoErr ?? null;

            const taErr =
              extra.tiempoTotalSegundos !== undefined && extra.tiempoTotalSegundos !== null
                ? Number(extra.tiempoTotalSegundos)
                : null;

            this.totalAcumulado = Number.isFinite(taErr) ? taErr : null;
            this.uploadProgress = 100;
            this.tipoError = null;
            this.cd.detectChanges();
            return;
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

  toggleLogs(): void {
    this.showLogs = !this.showLogs;
    this.cd.detectChanges();
  }

  limpiar(): void {
    if (this.estaImportando) return;

    this.archivoSeleccionado = null;
    this.isDragOver = false;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
    this.tipoError = null;
    this.uploadProgress = null;
    this.processedLines = null;
    this.totalAcumulado = null;
    this.rawLog = null;
    this.showLogs = false;
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
    this.auth.logout();
  }

  ngOnDestroy(): void {}

  private parsearDatosDesdeTexto(texto: string): ImportVentasResponse | null {
    if (!texto) return null;

    const textoLimpio = texto.replace(/[\u0080-\uFFFF]/g, ' ');

    const resultado: ImportVentasResponse = {};

    const loteMatch =
      /Lote\s+confirmado:\s*([0-9]+)\s+cabeceras\s*[|\-]\s*([0-9]+)\s+detalles\s*[|\-]\s*Total\s+acumulado:\s*([0-9]+)/i.exec(
        textoLimpio,
      );

    if (loteMatch) {
      const cabeceras = Number(loteMatch[1]);
      const detalles = Number(loteMatch[2]);
      const total = Number(loteMatch[3]);

      resultado.registrosExitosos = total;
      resultado.exitosas = cabeceras + detalles;
      resultado.registrosConError = 0;
      resultado.tiempoTotalSegundos = total;
      resultado.mensaje = `Lote confirmado: ${cabeceras.toLocaleString()} cabeceras + ${detalles.toLocaleString()} detalles`;

      return resultado;
    }

    const lecturaMatch = /Lectura\s+completada:\s*([0-9]+)\s+l[ií]neas\s+procesadas/i.exec(
      textoLimpio,
    );

    if (lecturaMatch) {
      const lines = Number(lecturaMatch[1]);

      resultado.registrosExitosos = lines;
      resultado.exitosas = lines;
      resultado.registrosConError = 0;
      resultado.mensaje = `Lectura completada: ${lines.toLocaleString()} líneas procesadas`;

      return resultado;
    }

    const totalAcumMatch = /Total\s+acumulado:\s*([0-9]+)/i.exec(textoLimpio);

    if (totalAcumMatch) {
      const total = Number(totalAcumMatch[1]);

      resultado.registrosExitosos = total;
      resultado.exitosas = total;
      resultado.tiempoTotalSegundos = total;
      resultado.registrosConError = 0;
      resultado.mensaje = `Total acumulado: ${total.toLocaleString()} registros procesados`;

      return resultado;
    }

    return null;
  }

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
