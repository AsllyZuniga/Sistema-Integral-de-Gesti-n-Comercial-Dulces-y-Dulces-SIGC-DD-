import { RoleId } from '../../../../../core/auth/roles';

export interface VentasViewOption {
  key: string;
  label: string;
}

export const VENTAS_VIEW_STORAGE_KEY = 'sigc-dd.dashboard.ventas.activeView';

export const VENTAS_VIEWS: VentasViewOption[] = [
  { key: 'ventas', label: 'Ventas' },
  { key: 'proveedor', label: 'Por Proveedor' },
  { key: 'categoria', label: 'Por Categoría' },
  { key: 'ciudad', label: 'Por Ciudad' },
  { key: 'cliente', label: 'Detalle por Cliente' },
  { key: 'vendedor', label: 'Por Vendedor' },
  { key: 'item', label: 'Detalle por Item' },
];

export function obtenerVistasVentasPorRol(rolId: number): VentasViewOption[] {
  if (rolId === RoleId.ADMINISTRADOR || rolId === RoleId.SUPERVISOR) {
    const filtered = VENTAS_VIEWS.filter((view) => view.key !== 'ventas');
    const vendedorIndex = filtered.findIndex((view) => view.key === 'vendedor');

    if (vendedorIndex > 0) {
      const vendedor = filtered.splice(vendedorIndex, 1)[0];
      filtered.unshift(vendedor);
    }

    return filtered;
  }

  if (rolId === RoleId.VENDEDOR) {
    return VENTAS_VIEWS.filter((view) => view.key !== 'ventas' && view.key !== 'vendedor');
  }

  return VENTAS_VIEWS;
}

export function esVistaVentasPermitidaPorRol(rolId: number, vista: string): boolean {
  return obtenerVistasVentasPorRol(rolId).some((view) => view.key === vista);
}
