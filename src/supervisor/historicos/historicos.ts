import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-historicos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './historicos.html',
  styleUrls: ['./historicos.css']
})
export class HistoricosComponent {
  supervisor = { name: 'Ana Supervisor' };
}
