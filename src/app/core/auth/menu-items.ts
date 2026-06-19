import { Params } from '@angular/router';
import { RoleId } from './roles';

export interface MenuItem {
  icon: string;
  label: string;
  ruta: string;
  roles: RoleId[];
  queryParams?: Params;
  activoPorParams?: Record<string, string>;
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
  },
  {
    icon: 'request_quote',
    label: 'Gestión de Cuotas',
    ruta: '/carga-cuotas',
    roles: [RoleId.ADMINISTRADOR],
  },
  {
    icon: 'group',
    label: 'Gestión Usuarios',
    ruta: '/gestion-usuarios',
    roles: [RoleId.ADMINISTRADOR],
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
