import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.css'],
})
export class TopbarComponent {
  @Input() titulo = 'Dashboard';
  @Input() subtitulo = 'Sistema de Control de Ventas · Dulces y Dulces';
  @Input() nombreUsuario = '';
  @Input() textoIntro = '';
  @Input() compacto = false;
  @Input() mostrarCerrarSesion = true;

  @Output() menuClick = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();

  get tituloVisible(): string {
    const intro = String(this.textoIntro ?? '').trim();
    const titulo = String(this.titulo ?? '').trim();
    return intro ? `${intro} ${titulo}` : titulo;
  }
}
