import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

type EstadoCarga = 'idle' | 'cargando' | 'exito' | 'error';
type TipoError = 'formato' | 'columnas' | 'datos' | 'servidor' | 'desconocido';

@Component({
  selector: 'app-carga',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './carga.component.html',
  styleUrls: ['./carga.component.css'],
})
export class CargaComponent {
  private readonly apiUrl = 'http://localhost:3000';

  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  archivoSeleccionado: File | null = null;
  estado: EstadoCarga = 'idle';
  resultado: any = null;
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
    return this.resultado.tiempoTotalSegundos ?? '—';
  }

  get tamanioMB(): string {
    if (!this.archivoSeleccionado) return '';
    return (this.archivoSeleccionado.size / 1024 / 1024).toFixed(2);
  }

  get estaImportando(): boolean {
    return this.estado === 'cargando';
  }

  constructor(private http: HttpClient, private cd: ChangeDetectorRef) {}

  onArchivoSeleccionado(event: Event): void {
    // Ignorar si está importando
    if (this.estaImportando) return;

    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const archivo = input.files[0];
    input.value = ''; // Limpiar input para permitir seleccionar el mismo archivo luego

    const nombre = archivo.name.toLowerCase();
    if (!nombre.endsWith('.txt') && !nombre.endsWith('.csv')) {
      this.setError('formato', 'Solo se aceptan archivos .txt o .csv exportados desde el ERP.');
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

    this.http.post(`${this.apiUrl}/import/ventas/upload`, formData, {
      responseType: 'text',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const textoRespuesta = response.body ?? '';
        const jsons = this.parsearJsonsConcatenados(textoRespuesta);

        if (jsons.length === 0) {
          this.setError('servidor', 'El servidor no devolvió una respuesta válida. Intenta nuevamente.');
          return;
        }

        const ultimoJson = jsons[jsons.length - 1];

        if (ultimoJson.status === 'error') {
          const { tipo, mensaje } = this.clasificarError(ultimoJson.mensaje ?? ultimoJson.error ?? '');
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
      error: (err) => {
        if (typeof err.error === 'string') {
          const jsons = this.parsearJsonsConcatenados(err.error);
          if (jsons.length > 0) {
            const ultimoJson = jsons[jsons.length - 1];
            const { tipo, mensaje } = this.clasificarError(ultimoJson.mensaje ?? ultimoJson.error ?? '');
            this.setError(tipo, mensaje);
            return;
          }
        }

        this.setError(
          'servidor',
          err?.error?.mensaje ?? err?.error?.message ?? err?.message ?? 'No se pudo conectar con el servidor.'
        );
      }
    });
  }

  limpiar(): void {
    if (this.estaImportando) return;
    this.archivoSeleccionado = null;
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
        mensaje: 'El archivo no tiene las columnas requeridas. Verifica que sea el plano de ventas correcto exportado desde el ERP.'
      };
    }

    if (msg.includes('formato') || msg.includes('separador') || msg.includes('tabulacion') || msg.includes('encoding') || msg.includes('parse')) {
      return {
        tipo: 'formato',
        mensaje: 'El archivo no tiene el formato correcto. Debe ser un .txt o .csv separado por tabulaciones exportado desde el ERP.'
      };
    }

    if (msg.includes('fecha') || msg.includes('numero') || msg.includes('número') || msg.includes('valor inv')) {
      return {
        tipo: 'datos',
        mensaje: 'El archivo contiene datos con formato incorrecto. Revisa los valores antes de importar.'
      };
    }

    if (msg.includes('database') || msg.includes('connection') || msg.includes('timeout') || msg.includes('sql')) {
      return {
        tipo: 'servidor',
        mensaje: 'Error interno del servidor. Contacta al administrador del sistema.'
      };
    }

    return {
      tipo: 'desconocido',
      mensaje: mensajeOriginal.length > 200 ? mensajeOriginal.substring(0, 200) + '...' : mensajeOriginal
    };
  }

  private parsearJsonsConcatenados(texto: string): any[] {
    const objetos: any[] = [];
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
          } catch {
            // fragmento inválido, ignorar
          }
          inicio = -1;
        }
      }
    }

    return objetos;
  }
}