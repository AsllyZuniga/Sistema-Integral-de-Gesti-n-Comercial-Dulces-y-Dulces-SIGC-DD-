import { RoleId } from '../../../../../core/auth/roles';
import { ImpactosViewOption } from '../models/impactos.model';

export const IMPACTOS_VIEWS: ImpactosViewOption[] = [
  { key: 'vendedor', label: 'Por Vendedor' },
  { key: 'proveedor', label: 'Por Proveedor' },
  { key: 'categoria', label: 'Por Categoría' },
];

export function obtenerVistasImpactosPorRol(rolId: number): ImpactosViewOption[] {
  if (rolId === RoleId.VENDEDOR) {
    return IMPACTOS_VIEWS.filter(v => v.key !== 'vendedor');
  }
  return IMPACTOS_VIEWS;
}
