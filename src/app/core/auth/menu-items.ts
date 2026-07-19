import { Params } from '@angular/router';
import { RoleId } from './roles';

export type ItemMenuRestringible = 'ventas' | 'cuotas' | 'usuarios';

export interface MenuItem {
  icon: string;
  label: string;
  ruta: string;
  roles: RoleId[];
  queryParams?: Params;
  activoPorParams?: Record<string, string>;
  itemRestringible?: ItemMenuRestringible;
}

export const MENU_ITEMS: MenuItem[] = [
  {
    icon: 'dashboard',
    label: 'Dashboard',
    ruta: '/dashboard',
    roles: [RoleId.ADMINISTRADOR],
  },
  {
    icon: 'upload_file',
    label: 'Gestión de ventas',
    ruta: '/carga',
    roles: [RoleId.ADMINISTRADOR],
    itemRestringible: 'ventas',
  },
  {
    icon: 'request_quote',
    label: 'Gestión de Cuotas',
    ruta: '/carga-cuotas',
    roles: [RoleId.ADMINISTRADOR],
    itemRestringible: 'cuotas',
  },
  {
    icon: 'group',
    label: 'Gestión Usuarios',
    ruta: '/gestion-usuarios',
    roles: [RoleId.ADMINISTRADOR],
    itemRestringible: 'usuarios',
  },
  {
    icon: 'groups',
    label: 'Vendedores asignados',
    ruta: '/dashboard',
    roles: [RoleId.SUPERVISOR],
    queryParams: { seccion: 'asignados' },
    activoPorParams: { seccion: 'asignados' },
  },
  {
    icon: 'analytics',
    label: 'Análisis de ventas',
    ruta: '/dashboard',
    roles: [RoleId.SUPERVISOR],
    queryParams: { seccion: 'analisis' },
    activoPorParams: { seccion: 'analisis' },
  },
  {
    icon: 'analytics',
    label: 'Análisis de ventas',
    ruta: '/dashboard',
    roles: [RoleId.VENDEDOR],
    queryParams: { vista: 'ventas' },
    activoPorParams: { vista: 'ventas' },
  },
];

export interface AccesosMenu {
  ventas: boolean;
  cuotas: boolean;
  usuarios: boolean;
}

export function obtenerMenuItemsPorRol(rolId: RoleId, accesos?: AccesosMenu): MenuItem[] {
  return MENU_ITEMS.filter((item) => {
    if (!item.roles.includes(rolId)) return false;
    if (!item.itemRestringible || !accesos) return true;
    return accesos[item.itemRestringible] !== false;
  });
}
