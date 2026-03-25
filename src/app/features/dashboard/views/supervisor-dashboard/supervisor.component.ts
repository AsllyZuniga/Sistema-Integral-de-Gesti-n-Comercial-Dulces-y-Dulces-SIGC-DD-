import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupervisorDashboardComponent } from '../supervisor/supervisor.component';

@Component({
  selector: 'app-supervisor-dashboard-legacy',
  standalone: true,
  imports: [CommonModule, SupervisorDashboardComponent],
  templateUrl: './supervisor.component.html',
  styleUrls: ['./supervisor.component.css'],
})
export class SupervisorComponent {}
