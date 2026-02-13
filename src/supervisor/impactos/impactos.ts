import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-impactos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './impactos.html',
  styleUrls: ['./impactos.css']
})
export class ImpactosComponent {
  supervisor = { name: 'Ana Supervisor' };
}
