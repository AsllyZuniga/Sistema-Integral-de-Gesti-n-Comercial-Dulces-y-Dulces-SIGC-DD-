import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-carga',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './carga.component.html',
  styleUrls: ['./carga.component.css'],
})
export class CargaComponent {
  private apiUrl = 'http://localhost:3000';

  // ✅ Referencia al sidebar para controlar drawer en móvil/tablet
  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;

  archivoSeleccionado: File | null = null;
  estado: 'idle' | 'cargando' | 'exito' | 'error' = 'idle';
  resultado: any = null;
  mensajeError: string = '';
  isSidebarCollapsed = false;

  // Campos mapeados de la respuesta real del backend
  get registrosExitosos(): number {
    return this.resultado?.exitosas ?? this.resultado?.registrosExitosos ?? 0;
  }

  get registrosConError(): number {
    return this.resultado?.errores ?? this.resultado?.registrosConError ?? 0;
  }

  get tiempoTotal(): string {
    if (!this.resultado) return '—';
    // El backend devuelve tiempoInicio y tiempoFin en ms
    if (this.resultado.tiempoInicio && this.resultado.tiempoFin) {
      return ((this.resultado.tiempoFin - this.resultado.tiempoInicio) / 1000).toFixed(2);
    }
    return this.resultado.tiempoTotalSegundos ?? '—';
  }

  constructor(private http: HttpClient) {}

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const archivo = input.files[0];

    // Solo .txt — igual que el backend
    if (!archivo.name.toLowerCase().endsWith('.txt')) {
      this.estado = 'error';
      this.mensajeError = 'Solo se permiten archivos con extensión .txt';
      input.value = '';
      return;
    }

    this.archivoSeleccionado = archivo;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
  }

  cargar() {
    if (!this.archivoSeleccionado) return;

    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);
    formData.append('batchSize', '10000'); // batch óptimo del importador

    this.estado = 'cargando';
    this.resultado = null;
    this.mensajeError = '';

    this.http.post<any>(`${this.apiUrl}/import/ventas/upload`, formData).subscribe({
      next: (res) => {
        this.estado = 'exito';
        this.resultado = res;
      },
      error: (err) => {
        this.estado = 'error';
        this.mensajeError = err?.error?.message ?? err?.message ?? 'Error al cargar el archivo';
      }
    });
  }

  limpiar() {
    this.archivoSeleccionado = null;
    this.estado = 'idle';
    this.resultado = null;
    this.mensajeError = '';
    const input = document.getElementById('fileInput') as HTMLInputElement;
    if (input) input.value = '';
  }

  toggleMenuMovil() {
    this.sidebarRef?.toggleMobile();
  }

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  get tamanioMB(): string {
    if (!this.archivoSeleccionado) return '';
    return (this.archivoSeleccionado.size / 1024 / 1024).toFixed(2);
  }
}