import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableComponent } from '../../../../shared/components/table/table.component';
import { ChartComponent } from '../../../../shared/components/chart/chart.component';
import { DashboardFilters } from '../../../../shared/components/filters/filters.component';

// ⏸️ Servicio comentado — endpoints del backend pendientes de implementación
// import { DevolucionesService } from '../../../../core/services/devoluciones/devoluciones.service';

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [CommonModule, TableComponent, ChartComponent],
  templateUrl: './devoluciones.component.html',
  styleUrls: ['./devoluciones.component.css'],
})
export class DevolucionesComponent implements OnChanges {
  // ⏸️ private devolucionesService = inject(DevolucionesService);

  @Input() codigoVendedor: string = '';

  @Input() filtros: DashboardFilters = {
    fechaInicio: '',
    fechaFin:    '',
    vendedor:    '',
    proveedor:   '',
    categoria:   '',
    ciudad:      '',
  };

  devolucionesViews = [
    { key: 'clientes',  label: 'Por Cliente' },
    { key: 'proveedor', label: 'Por Proveedor' },
    { key: 'ciudad',    label: 'Por Ciudad' },
  ];
  activeView: string = 'clientes';

  tableData: any[] = [];
  chartData: any[] = [];
  chartType: 'bar' | 'line' | 'pie' = 'bar';
  chartId: string = 'devoluciones-chart';

  clientesAgrupados: ClienteAgrupado[] = [];

  proveedorColumns: string[] = ['proveedor', 'devoluciones', 'valorTotal'];
  ciudadColumns:    string[] = ['ciudad',    'devoluciones', 'valorTotal'];
  detalleColumns:   string[] = ['fecha', 'producto', 'cantidad', 'valorTotal', 'motivo'];

  // ⏸️ Sin reacción hasta que el backend esté listo
  ngOnChanges(changes: SimpleChanges): void { }

  setView(key: string): void {
    this.activeView = key;
    this.chartId = `devoluciones-chart-${key}`;
  }

  toggleCliente(cliente: ClienteAgrupado): void {
    cliente.expandido = !cliente.expandido;
  }

  // ⏸️ Descomentar cuando el backend esté disponible:
  /*
  private cargarDatos(): void {
    if (!this.codigoVendedor) return;
    const filtrosConVendedor: DashboardFilters = { ...this.filtros, vendedor: this.codigoVendedor };
    switch (this.activeView) {
      case 'clientes':
        this.devolucionesService.getPorCliente(filtrosConVendedor).subscribe((data: any[]) => {
          this.tableData = data;
          this.agruparClientes(data);
        });
        break;
      case 'proveedor':
        this.chartType = 'bar';
        this.devolucionesService.getPorProveedor(filtrosConVendedor).subscribe((data: any[]) => {
          this.tableData = data;
          this.chartData = data.map((d: any) => ({ name: d.proveedor, value: d.devoluciones }));
        });
        break;
      case 'ciudad':
        this.chartType = 'bar';
        this.devolucionesService.getPorCiudad(filtrosConVendedor).subscribe((data: any[]) => {
          this.tableData = data;
          this.chartData = data.map((d: any) => ({ name: d.ciudad, value: d.devoluciones }));
        });
        break;
    }
  }

  private agruparClientes(data: any[]): void {
    const mapa = new Map<string, ClienteAgrupado>();
    for (const row of data) {
      const nombre = row.cliente ?? 'Sin cliente';
      if (!mapa.has(nombre)) {
        mapa.set(nombre, { nombre, totalDevoluciones: 0, valorTotal: 0, devoluciones: [], expandido: false });
      }
      const entrada = mapa.get(nombre)!;
      entrada.totalDevoluciones += Number(row.devoluciones ?? 1);
      entrada.valorTotal        += Number(row.valorTotal   ?? 0);
      entrada.devoluciones.push(row);
    }
    this.clientesAgrupados = Array.from(mapa.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }
  */
}

interface ClienteAgrupado {
  nombre: string;
  totalDevoluciones: number;
  valorTotal: number;
  devoluciones: any[];
  expandido: boolean;
}