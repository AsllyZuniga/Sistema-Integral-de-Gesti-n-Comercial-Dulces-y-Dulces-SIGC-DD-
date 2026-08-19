export interface ImpactosViewOption {
  key: string;
  label: string;
}

export interface ImpactoProveedorRow {
  proveedor: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  faltan: number;
}

export interface ImpactoCategoriaRow {
  categoria: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  faltan: number;
}

export interface ImpactoVendedorRow {
  vendedor: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  faltan: number;
}

export type ImpactoRow = ImpactoProveedorRow | ImpactoCategoriaRow | ImpactoVendedorRow;

export interface ImpactosResponse {
  rows: ImpactoRow[];
  total: number;
}
