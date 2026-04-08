import { Injectable } from '@angular/core';

export interface SessionUser {
  jwt?: string;
  token?: string;
  rol?: { idRol?: string | number; nombre?: string };
  idRol?: string | number;
  rolId?: string | number;
  idUsuario?: string | number;
  id_usuario?: string | number;
  id?: string | number;
  idVendedor?: string | number | null;
  id_vendedor?: string | number | null;
  idVendedorAsociado?: string | number | null;
  codVendedor?: string | number | null;
  codigo?: string | number | null;
  codigo_vendedor?: string | number | null;
  nombre?: string;
  username?: string;
  estado?: boolean;
  vendedor?: {
    idVendedor?: string | number | null;
    id_vendedor?: string | number | null;
    id?: string | number | null;
    codigo?: string | number | null;
    codigo_vendedor?: string | number | null;
    codVendedor?: string | number | null;
  };
}

const SESSION_KEY = 'vendedor';

@Injectable({ providedIn: 'root' })
export class SessionService {
  getUser(): SessionUser | null {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  saveUser(user: SessionUser): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  clearUser(): void {
    sessionStorage.removeItem(SESSION_KEY);
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem(SESSION_KEY);
  }

  getToken(): string | null {
    const user = this.getUser();
    return (user?.jwt ?? user?.token ?? null) as string | null;
  }

  getRoleId(): number {
    const user = this.getUser();
    return Number(user?.rol?.idRol ?? user?.idRol ?? user?.rolId ?? 0);
  }
}