import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-agotados',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './agotados.html',
  styleUrls: ['./agotados.css']
})
export class AgotadosComponent {
  supervisor = { name: 'Ana Supervisor' };
}
