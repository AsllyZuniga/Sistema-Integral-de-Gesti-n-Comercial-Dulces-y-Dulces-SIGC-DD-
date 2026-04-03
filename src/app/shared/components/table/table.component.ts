import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.css'],
})
export class TableComponent {
  @Input() columns: string[] = [];
  @Input() data: any[] = [];

  private readonly headerMap: Record<string, string> = {
    codVendedor: 'Cód. Vendedor',
    nombre: 'Nombre',
    cuotaMes: 'Cuota Mes',
    cuotaSemana: 'Cuota Semana',
    cuotaDiaria: 'Cuota Diaria',
    cuotaLinea: 'Cuota Línea',
    ventaAcum: 'Venta Acum.',
    porcCump: 'Cumpl. %',
    proyeccionVenta: 'Proyección',
    porcCumProy: 'Cumpl. Proy. %',
    linea: 'Línea',
    ciudad: 'Ciudad',
    Fecha: 'Fecha',
    Proveedor: 'Proveedor',
    Cod_Item: 'Cód. Item',
    id_item: 'ID Item',
    Descripcion: 'Descripción',
    Venta_Unid_Cajas: 'Unid. Cajas',
    Cantidad: 'Cantidad',
    cantidad: 'Cantidad',
    cliente: 'Cliente',
    cantidadItems: 'Cantidad Items',
    proveedor: 'Proveedor',
    producto: 'Producto',
    precio_unitario: 'Precio Unitario',
    subtotal_producto: 'Subtotal Producto',
    Subtotal: 'Subtotal',
    impactos: 'Impactos',
    valorTotal: 'Valor Total',
  };

  private readonly currencyCols = new Set([
    'cuotaMes',
    'cuotaSemana',
    'cuotaDiaria',
    'cuotaLinea',
    'ventaAcum',
    'proyeccionVenta',
    'valorTotal',
    'precio_unitario',
    'subtotal_producto',
    'Subtotal',
  ]);
  private readonly percentCols = new Set(['porcCump', 'porcCumProy']);
  private readonly integerCols = new Set(['Venta_Unid_Cajas', 'Cantidad', 'cantidad', 'impactos']);
  private readonly integerColsExt = new Set(['cantidadItems']);

  getHeader(col: string): string {
    return this.headerMap[col] ?? col;
  }

  formatCell(col: string, value: any): string {
    if (value === null || value === undefined || value === '') return '—';

    if (this.currencyCols.has(col)) {
      const num = Number(value);
      return isNaN(num)
        ? value
        : '$\u00a0' +
            num.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    if (this.percentCols.has(col)) {
      const num = Number(value);
      return isNaN(num)
        ? value
        : num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
            '\u00a0%';
    }

    if (this.integerCols.has(col) || this.integerColsExt.has(col)) {
      const num = Number(value);
      return isNaN(num) ? value : num.toLocaleString('es-CO');
    }

    return value;
  }

  getCellClass(col: string, value: any): string {
    if (!this.percentCols.has(col)) return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    if (num >= 100) return 'cell-success';
    if (num >= 70) return 'cell-warning';
    return 'cell-danger';
  }
}
