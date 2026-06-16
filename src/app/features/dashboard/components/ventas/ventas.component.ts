import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasTabsComponent } from './ui/ventas-tabs.component';
import { VentasTablaGraficaComponent } from './ui/ventas-tabla-grafica.component';
import { VentasClientesDetalleComponent } from './ui/ventas-clientes-detalle.component';
import { VentasVendedorBase } from './roles/vendedor/ventas-vendedor-base';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    VentasTabsComponent,
    VentasTablaGraficaComponent,
    VentasClientesDetalleComponent,
  ],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class VentasComponent extends VentasVendedorBase {}
