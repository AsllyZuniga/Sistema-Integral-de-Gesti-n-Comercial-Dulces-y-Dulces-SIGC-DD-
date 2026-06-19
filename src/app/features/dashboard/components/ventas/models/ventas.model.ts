export interface PuntoGraficaVentas {
  name: string;
  value: number;
}

export interface FilaVentaBase {
  codVendedor?: string;
  nombre?: string;
  ventaAcum?: number;
  proyeccionVenta?: number;
  porcCump?: number;
  porcCumProy?: number;
}

export interface ClienteVentasDetalle {
  key: string;
  cliente: string;
  sucursal: string;
  ventaAcum: number;
  productos: unknown[];
}
