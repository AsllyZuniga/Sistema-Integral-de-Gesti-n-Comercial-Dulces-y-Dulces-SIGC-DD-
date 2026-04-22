import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-impactos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './impactos.component.html',
  styleUrls: ['./impactos.component.css'],
})
export class ImpactosComponent {
  impactosViews = [
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad', label: 'Por Ciudad' },
    { key: 'item', label: 'Por Item' },
    { key: 'categoria', label: 'Por Categoría' },
  ];

  activeImpactosView: string = 'proveedor';

  setImpactosView(key: string): void {
    this.activeImpactosView = key;
  }
}
