import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './devoluciones.html',
  styleUrls: ['./devoluciones.css']
})
export class DevolucionesComponent {
  supervisor = { name: 'Ana Supervisor' };
}
