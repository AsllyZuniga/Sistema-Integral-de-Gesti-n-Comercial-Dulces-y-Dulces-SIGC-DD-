import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
})
export class SidebarComponent {
  isCollapsed = false;

  @Output() toggle = new EventEmitter<boolean>();

  readonly navItems = [
    { icon: 'dashboard',      label: 'Dashboard'      },
    { icon: 'inventory_2',    label: 'Detalle'        },
    { icon: 'assignment_return', label: 'Devoluciones'},
    { icon: 'history',        label: 'Históricos'     },
    { icon: 'trending_up',    label: 'Impactos'       },
    { icon: 'verified',       label: 'Nivel Servicio' },
  ];

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.toggle.emit(this.isCollapsed);
  }
}