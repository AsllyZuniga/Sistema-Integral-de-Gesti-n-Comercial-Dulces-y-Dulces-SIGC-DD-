import { Component } from '@angular/core';
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
  private apiUrl = 'https://api.sisferahub.com';

  archivoSeleccionado: File | null = null;
  estado: 'idle' | 'cargando' | 'exito' | 'error' = 'idle';
  resultado: any = null;
  mensajeError: string = '';
  isSidebarCollapsed = false;

  constructor(private http: HttpClient) { }

  onArchivoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoSeleccionado = input.files[0];
      this.estado = 'idle';
      this.resultado = null;
      this.mensajeError = '';
    }
  }

  cargar() {
    if (!this.archivoSeleccionado) return;

    const formData = new FormData();
    formData.append('archivo', this.archivoSeleccionado);
    formData.append('batchSize', '100');

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
    // limpiar input file
    const input = document.getElementById('fileInput') as HTMLInputElement;
    if (input) input.value = '';
  }

  onToggleSidebar(collapsed: boolean) {
    this.isSidebarCollapsed = collapsed;
  }

  get tamanioMB(): string {
    if (!this.archivoSeleccionado) return '';
    return (this.archivoSeleccionado.size / 1024 / 1024).toFixed(2);
  }
}