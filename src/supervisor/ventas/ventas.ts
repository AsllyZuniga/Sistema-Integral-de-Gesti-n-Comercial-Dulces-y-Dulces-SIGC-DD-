import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css']
})
export class VentasComponent {
  supervisor = { name: 'Ana Supervisor' };
}
