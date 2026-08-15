export interface ImpactosViewOption {
  key: string;
  label: string;
}

export interface ImpactoProveedorRow {
  proveedor: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  proyeccionImpactos: number;
}

export interface ImpactoCategoriaRow {
  categoria: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  proyeccionImpactos: number;
}

export interface ImpactoCanalRow {
  canal: string;
  cuotaImpactos?: number;
  impactos: number;
  porcCump?: number;
  proyeccionImpactos?: number;
}

export interface ImpactoVendedorRow {
  vendedor: string;
  cuotaImpactos: number;
  impactos: number;
  porcCump: number;
  proyeccionImpactos: number;
}

export type ImpactoRow =
  | ImpactoProveedorRow
  | ImpactoCategoriaRow
  | ImpactoCanalRow
  | ImpactoVendedorRow;

export interface ImpactosResponse {
  rows: ImpactoRow[];
  total: number;
}
