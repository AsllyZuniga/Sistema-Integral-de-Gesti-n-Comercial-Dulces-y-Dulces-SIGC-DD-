import { Params } from '@angular/router';
import { RoleId } from './roles';

export interface MenuItem {
  icon: string;
  label: string;
  ruta: string;
  roles: RoleId[];
  queryParams?: Params;
  activoPorParams?: Record<string, string>;
  restringidoParaUsuarios?: string[];
}

// Admins a los que se les oculta Gestión de ventas/Cuotas/Usuarios: solo ven Dashboard.
const ADMIN_USERNAMES_RESTRINGIDOS = ['Diego Penagos', 'Juan José Buitrago'];

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
    restringidoParaUsuarios: ADMIN_USERNAMES_RESTRINGIDOS,
  },
  {
    icon: 'request_quote',
    label: 'Gestión de Cuotas',
    ruta: '/carga-cuotas',
    roles: [RoleId.ADMINISTRADOR],
    restringidoParaUsuarios: ADMIN_USERNAMES_RESTRINGIDOS,
  },
  {
    icon: 'group',
    label: 'Gestión Usuarios',
    ruta: '/gestion-usuarios',
    roles: [RoleId.ADMINISTRADOR],
    restringidoParaUsuarios: ADMIN_USERNAMES_RESTRINGIDOS,
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

export function obtenerMenuItemsPorRol(rolId: RoleId, username?: string): MenuItem[] {
  const nombreUsuario = (username ?? '').trim().toLowerCase();
  return MENU_ITEMS.filter((item) => {
    if (!item.roles.includes(rolId)) return false;
    if (!item.restringidoParaUsuarios?.length) return true;
    return !item.restringidoParaUsuarios.some(
      (restringido) => restringido.trim().toLowerCase() === nombreUsuario,
    );
  });
}
