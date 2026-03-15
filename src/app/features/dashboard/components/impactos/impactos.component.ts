import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';

// ⏸️ Servicio comentado — endpoints del backend pendientes de implementación
// import { ImpactosService } from '../../../../core/services/impactos/impactos.service';

@Component({
  selector: 'app-impactos',
  standalone: true,
  imports: [CommonModule, TableComponent, ChartComponent],
  templateUrl: './impactos.component.html',
  styleUrls: ['./impactos.component.css'],
})
export class ImpactosComponent implements OnChanges {
  // ⏸️ private impactosService = inject(ImpactosService);

  @Input() codigoVendedor: string = '';

  @Input() filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin:    '',
    vendedor:    '',
    proveedor:   '',
    categoria:   '',
    ciudad:      '',
  };

  impactosViews = [
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad',    label: 'Por Ciudad' },
    { key: 'detalle',   label: 'Detalle' },
  ];
  activeImpactosView: string = 'proveedor';

  tableData: any[] = [];
  chartData: any[] = [];
  chartType: 'bar' | 'line' | 'pie' = 'bar';
  chartId: string = 'impactos-chart';

  proveedorColumns: string[] = ['proveedor', 'impactos', 'valorTotal'];
  ciudadColumns:    string[] = ['ciudad',    'impactos', 'valorTotal'];
  detalleColumns:   string[] = ['proveedor', 'producto', 'impactos', 'valorTotal'];

  // ⏸️ Sin reacción hasta que el backend esté listo
  ngOnChanges(changes: SimpleChanges): void { }

  setImpactosView(key: string): void {
    this.activeImpactosView = key;
    this.chartId = `impactos-chart-${key}`;
  }

  // ⏸️ Descomentar cuando el backend esté disponible:
  /*
  private cargarDatos(): void {
    if (!this.codigoVendedor) return;
    const filtrosConVendedor: DashboardFilters = { ...this.filtros, vendedor: this.codigoVendedor };
    switch (this.activeImpactosView) {
      case 'proveedor':
        this.chartType = 'bar';
        this.impactosService.getPorProveedor(filtrosConVendedor).subscribe((data: any[]) => {
          this.tableData = data;
          this.chartData = data.map((d: any) => ({ name: d.proveedor, value: d.impactos }));
        });
        break;
      case 'ciudad':
        this.chartType = 'bar';
        this.impactosService.getPorCiudad(filtrosConVendedor).subscribe((data: any[]) => {
          this.tableData = data;
          this.chartData = data.map((d: any) => ({ name: d.ciudad, value: d.impactos }));
        });
        break;
      case 'detalle':
        this.chartType = 'bar';
        this.impactosService.getDetalle(filtrosConVendedor).subscribe((data: any[]) => {
          this.tableData = data;
          const top10 = [...data].sort((a: any, b: any) => b.impactos - a.impactos).slice(0, 10);
          this.chartData = top10.map((d: any) => ({ name: d.producto, value: d.impactos }));
        });
        break;
    }
  }
  */
}