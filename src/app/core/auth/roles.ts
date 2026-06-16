export enum RoleId {
  ADMINISTRADOR = 1,
  SUPERVISOR = 2,
  VENDEDOR = 3,
}

export const DASHBOARD_ROLES = [RoleId.ADMINISTRADOR, RoleId.SUPERVISOR, RoleId.VENDEDOR];
export const ADMIN_ROLES = [RoleId.ADMINISTRADOR];
export const ANALISIS_ROLES = [RoleId.ADMINISTRADOR, RoleId.SUPERVISOR];

export function esAdministrador(rolId: number): boolean {
  return Number(rolId) === RoleId.ADMINISTRADOR;
}

export function esSupervisor(rolId: number): boolean {
  return Number(rolId) === RoleId.SUPERVISOR;
}

export function esVendedor(rolId: number): boolean {
  return Number(rolId) === RoleId.VENDEDOR;
}

export function nombreRol(rolId: number): string {
  if (esAdministrador(rolId)) return 'Admin';
  if (esSupervisor(rolId)) return 'Supervisor';
  return 'Vendedor';
}
