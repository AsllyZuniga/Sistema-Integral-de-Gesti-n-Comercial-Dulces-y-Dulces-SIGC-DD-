export interface ImpactosViewOption {
  key: string;
  label: string;
}

export interface ImpactoBaseRow {
  vendedor: string;
  tipoPeriodo: string;
  fechaInicio: string;
  fechaFin: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  faltan: number;
}

export interface ImpactoVendedorRow extends ImpactoBaseRow {
  codVendedor?: string;
  nombre?: string;
}

export interface ImpactoProveedorRow extends ImpactoBaseRow {
  proveedor: string;
}

export interface ImpactoCategoriaRow extends ImpactoBaseRow {
  categoria: string;
}

export type ImpactoRow = ImpactoVendedorRow | ImpactoProveedorRow | ImpactoCategoriaRow;

export interface ImpactosResponse {
  success: boolean;
  tipo: string;
  total: number;
  rows: ImpactoRow[];
}
