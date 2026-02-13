import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './supervisor-dashboard.html',
  styleUrls: ['./supervisor-dashboard.css']
})
export class SupervisorDashboardComponent implements OnInit {
  supervisor = { name: 'Ana Supervisor', company: 'Dulces y Dulces', role: 'Supervisor' };
  stats = { activeSellers: 3, teamNetSales: 9265000, returns: 580000 };
  topSeller = { name: 'María González', email: 'maria@dulcesydulces.com', net: 4795000, returnsPercent: 1.54, compliance: 11.99, clients: 3 };
  worstSeller = { name: 'Pedro Ramírez', email: 'pedro@dulcesydulces.com', net: 490000, returnsPercent: 32.41, compliance: 1.23, clients: 5 };

  constructor() { }
  ngOnInit() { }

  viewDetail(seller: any) {
    // placeholder: open detail modal or navigate
    console.log('Ver detalle de', seller.name);
  }
}
