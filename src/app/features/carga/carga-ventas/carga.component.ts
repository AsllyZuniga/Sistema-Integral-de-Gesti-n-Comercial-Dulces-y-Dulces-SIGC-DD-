import { Component, ViewChild, ChangeDetectorRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Router } from '@angular/router';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { AuthService } from '../../../core/services/auth.service';
import { SessionUser } from '../../../core/services/session.service';
import { environment } from '../../../../environments/environment';
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
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './carga.component.html',
  styleUrls: ['./carga.component.css'],
})
export class CargaComponent implements OnInit, OnDestroy {
  private readonly apiUrl = environment.apiUrl;

  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  vendedor: SessionUser | null = null;
  sidebarColapsado = false;
  isDragOver = false;
  estado: EstadoCarga = 'idle';
  resultado: ImportVentasResponse | null = null;
  mensajeError = '';
  tipoError: TipoError | null = null;
  sidebarColapsado = false;
  // Sales upload properties
  archivoSeleccionado: File | null = null;
  uploadProgress: number | null = null;
  // datos extraídos desde logs de texto si el backend no devuelve JSON
  processedLines: number | null = null;
  totalAcumulado: number | null = null;
  // raw logs recibidos desde el backend (texto plano)
  rawLog: string | null = null;
  // mostrar/ocultar logs completos en UI
  showLogs = false;

  // Fecha rango para acciones en ventas (ISO yyyy-MM-dd)
  fechaInicio: string | null = null;
  fechaFin: string | null = null;

  // preview/delete state
  cargandoPreview = false;
  previewResult: any = null;
  eliminando = false;
  mensajeOperacion: string | null = null;
  tipoOperacion: 'success' | 'error' | null = null;
  // confirm modal
  showConfirmModal = false;
  confirmInput = '';

  get registrosExitosos(): number {
    return this.resultado?.exitosas ?? this.resultado?.registrosExitosos ?? 0;
  }

  get periodoSeleccionado(): string {
    if (!this.fechaInicio || !this.fechaFin) return 'periodo no seleccionado';
    return `${this.fechaInicio} - ${this.fechaFin}`;
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
      this.mensajeOperacion = 'Seleccione fecha inicio y fin para previsualizar (mm/dd/yyyy)';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    this.cargandoPreview = true;
    this.previewResult = null;
    this.mensajeOperacion = null;
    this.tipoOperacion = null;

    const url = `${this.apiUrl}/admin/ventas/preview?fechaInicio=${isoInicio}&fechaFin=${isoFin}`;
    this.http.get(url).subscribe({
      next: (res) => {
        this.previewResult = res;
        this.cargandoPreview = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        this.cargandoPreview = false;
        this.mensajeOperacion = 'Error al obtener previsualización';
        this.tipoOperacion = 'error';
        this.cd.detectChanges();
      },
    });
  }

  eliminarVentas(): void {
    // kept for compatibility, prefer using openConfirmEliminar()
    this.openConfirmEliminar();
  }

  openConfirmEliminar(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicio);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFin);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.mensajeOperacion = 'Seleccione fecha inicio y fin para eliminar ventas';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.mensajeOperacion = 'La fecha inicio no puede ser mayor que la fecha fin';
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

  private parseInputDateToIso(val: string | null): string | null {
    if (!val) return null;

    const v = val.trim();

    const mmddyyyy = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})$/;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/;

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

  finalDelete(): void {
    const fechaIsoInicio = this.parseInputDateToIso(this.fechaInicio);
    const fechaIsoFin = this.parseInputDateToIso(this.fechaFin);

    if (!fechaIsoInicio || !fechaIsoFin) {
      this.showConfirmModal = false;
      this.mensajeOperacion = 'Fechas inválidas. Use el formato mm/dd/yyyy';
      this.tipoOperacion = 'error';
      this.cd.detectChanges();
      return;
    }

    if (!this.esRangoFechasValido(fechaIsoInicio, fechaIsoFin)) {
      this.showConfirmModal = false;
      this.mensajeOperacion = 'La fecha inicio no puede ser mayor que la fecha fin';
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

    const url = `${this.apiUrl}/admin/ventas?fechaInicio=${fechaIsoInicio}&fechaFin=${fechaIsoFin}`;

    this.http.delete(url, { responseType: 'text' }).subscribe({
      next: () => {
        this.eliminando = false;
        this.showConfirmModal = false;
        this.confirmInput = '';
        this.mensajeOperacion = `Ventas eliminadas correctamente para el ${this.periodoSeleccionado}`;
        this.tipoOperacion = 'success';
        this.cd.detectChanges();
      },
      error: (err) => {
        this.eliminando = false;
        this.showConfirmModal = false;
        this.confirmInput = '';
        this.mensajeOperacion =
          err?.error?.mensaje ??
          err?.error?.message ??
          err?.message ??
          'Error al eliminar ventas';
        this.tipoOperacion = 'error';
        this.cd.detectChanges();
      },
    });
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
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.vendedor = this.auth.getVendedor();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggle();
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
    this.uploadProgress = 0;
    this.processedLines = null;
    this.totalAcumulado = null;
    this.cd.detectChanges();

    // Usamos observe: 'events' para mostrar progreso de subida (upload)
    this.http
      .post(`${this.apiUrl}/import/ventas/upload`, formData, {
        responseType: 'text',
        observe: 'events',
        reportProgress: true,
      })
      .pipe(timeout(300000)) // 5 minutos de timeout
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
            // Guardar log crudo para que el usuario lo pueda revisar si lo desea
            this.rawLog = typeof textoRespuesta === 'string' ? textoRespuesta : null;
            const jsons = this.parsearJsonsConcatenados(textoRespuesta);

            if (jsons.length === 0) {
              // Intentar extraer información útil desde logs en texto plano
              const extra = this.parsearDatosDesdeTexto(textoRespuesta);
              if (extra) {
                this.estado = 'exito';
                this.resultado = extra;
                // asegurar rawLog esté disponible aunque parseemos éxito
                this.rawLog = this.rawLog ?? textoRespuesta ?? null;
                this.processedLines = extra.registrosExitosos ?? extra.registrosConError ?? null;
                // Asegurar que totalAcumulado sea number | null
                const ta = extra.tiempoTotalSegundos !== undefined && extra.tiempoTotalSegundos !== null
                  ? Number(extra.tiempoTotalSegundos)
                  : null;
                this.totalAcumulado = Number.isFinite(ta) ? (ta as number) : null;
                this.tipoError = null;
                this.uploadProgress = 100;
                this.cd.detectChanges();
                return;
              }

              // Fallback: si el texto contiene indicadores de proceso, considerarlo éxito
              const hayIndicadores = /Lectura completada|Lote confirmado|Detalles insertados|Procesando batch/i.test(
                textoRespuesta,
              );
              if (hayIndicadores) {
                // Construir un resumen conciso en lugar de volcar todo el log
                const fallback: ImportVentasResponse = {
                  mensaje: 'Proceso completado (resumen extraído de logs)',
                  registrosConError: 0,
                };
                // intentar extraer números de lectura/total nuevamente
                const lectura = /Lectura completada:\s*([0-9,.]+)\s*l[ií]neas procesadas/i.exec(
                  textoRespuesta,
                );
                if (lectura) fallback.registrosExitosos = Number(lectura[1].replace(/[,\.]/g, ''));
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
                this.totalAcumulado = typeof fallback.tiempoTotalSegundos === 'number' ? fallback.tiempoTotalSegundos : null;
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

            this.setError('desconocido', ultimoJson.mensaje ?? 'Respuesta inesperada del servidor.');
          }
        },
        error: (err: HttpErrorResponse) => {
          // Si el backend devuelve logs en texto en err.error, intentar extraer info útil
          const textoErr = typeof err.error === 'string' ? err.error : '';
          // Guardar log crudo en caso de error para permitir inspección
          this.rawLog = this.rawLog ?? (typeof err.error === 'string' ? err.error : null);
          const jsons = textoErr ? this.parsearJsonsConcatenados(textoErr) : [];
          
          if (jsons.length > 0) {
            const ultimoJson = jsons[jsons.length - 1];
            const { tipo, mensaje } = this.clasificarError(ultimoJson.mensaje ?? ultimoJson.error ?? '');
            this.setError(tipo, mensaje);
            return;
          }

          // Intentar extraer datos desde logs de texto
          const extra = this.parsearDatosDesdeTexto(textoErr || (err.error as any) || '');
          if (extra) {
            // Si detectamos "Lectura completada" en los logs, es un éxito aunque HTTP sea error
            this.estado = 'exito';
            this.resultado = extra;
            this.rawLog = this.rawLog ?? textoErr ?? null;
            const taErr = extra.tiempoTotalSegundos !== undefined && extra.tiempoTotalSegundos !== null
              ? Number(extra.tiempoTotalSegundos)
              : null;
            this.totalAcumulado = Number.isFinite(taErr) ? (taErr as number) : null;
            this.uploadProgress = 100;
            this.tipoError = null;
            this.cd.detectChanges();
            return;
          }

          // Si no encontramos éxito en los logs, entonces sí es un error real
          this.setError(
            'servidor',
            err?.error?.mensaje ?? err?.error?.message ?? err?.message ?? 'No se pudo conectar con el servidor.',
          );
        },
      });
  }

  toggleLogs(): void {
    this.showLogs = !this.showLogs;
    this.cd.detectChanges();
  }

  private parsearDatosDesdeTexto(texto: string): ImportVentasResponse | null {
    if (!texto) return null;

    // Limpiar caracteres especiales (emojis, timestamps, etc) para parsing
    const textoLimpio = texto.replace(/[\u0080-\uFFFF]/g, ' '); // Remover emojis y caracteres especiales

    const resultado: ImportVentasResponse = {};

    // Patrón 1: "Lote confirmado: 635 cabeceras | 4948 detalles | Total acumulado: 154948"
    // Hacer el regex más flexible para capturar espacios y diferentes separadores
    const loteMatch = /Lote\s+confirmado:\s*([0-9]+)\s+cabeceras\s*[|\-]\s*([0-9]+)\s+detalles\s*[|\-]\s*Total\s+acumulado:\s*([0-9]+)/i.exec(textoLimpio);
    
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

    // Patrón 2: "Lectura completada: 154948 líneas procesadas"
    const lecturaMatch = /Lectura\s+completada:\s*([0-9]+)\s+l[ií]neas\s+procesadas/i.exec(textoLimpio);
    if (lecturaMatch) {
      const lines = Number(lecturaMatch[1]);
      resultado.registrosExitosos = lines;
      resultado.exitosas = lines;
      resultado.registrosConError = 0;
      resultado.mensaje = `Lectura completada: ${lines.toLocaleString()} líneas procesadas`;
      return resultado;
    }

    // Patrón 3: "Total acumulado: 154948"
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
    this.auth.logout();
  }

  ngOnDestroy(): void {
    // Cleanup
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
