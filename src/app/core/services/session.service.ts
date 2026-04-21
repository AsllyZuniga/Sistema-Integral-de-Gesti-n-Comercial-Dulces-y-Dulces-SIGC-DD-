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
const SESSION_NONCE_KEY = 'auth_session_nonce';
const AUTH_EVENT_KEY = 'auth_event';
const SESSION_FINGERPRINT_KEY = 'auth_fp';

type AuthEventType = 'login' | 'logout';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private buildFingerprint(): string {
    const ua = String(navigator.userAgent ?? '');
    const lang = String(navigator.language ?? '');
    const platform = String(navigator.platform ?? '');
    return `${ua}|${lang}|${platform}`;
  }

  private sanitizeUser(user: SessionUser): SessionUser {
    return {
      jwt: String(user?.jwt ?? user?.token ?? '').trim() || undefined,
      rol: user?.rol,
      idRol: user?.idRol,
      rolId: user?.rolId,
      idUsuario: user?.idUsuario,
      id_usuario: user?.id_usuario,
      id: user?.id,
      idVendedor: user?.idVendedor,
      id_vendedor: user?.id_vendedor,
      idVendedorAsociado: user?.idVendedorAsociado,
      codVendedor: user?.codVendedor,
      codigo: user?.codigo,
      codigo_vendedor: user?.codigo_vendedor,
      nombre: user?.nombre,
      username: user?.username,
      estado: user?.estado,
      vendedor: user?.vendedor,
    };
  }

  private buildNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private emitirEvento(tipo: AuthEventType, nonce: string | null): void {
    try {
      localStorage.setItem(
        AUTH_EVENT_KEY,
        JSON.stringify({
          tipo,
          nonce,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // Ignorar errores de storage (modo privado/restricciones).
    }
  }

  private registrarNonceSesion(): string {
    const nonce = this.buildNonce();
    sessionStorage.setItem(SESSION_NONCE_KEY, nonce);
    this.emitirEvento('login', nonce);
    return nonce;
  }

  getNonceSesion(): string {
    return String(sessionStorage.getItem(SESSION_NONCE_KEY) ?? '').trim();
  }

  leerEventoAuth(raw: string | null): { tipo: AuthEventType; nonce: string; timestamp: number } | null {
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const tipo = parsed?.tipo;
      const nonce = String(parsed?.nonce ?? '').trim();
      const timestamp = Number(parsed?.timestamp ?? 0);

      if ((tipo !== 'login' && tipo !== 'logout') || !Number.isFinite(timestamp)) {
        return null;
      }

      return { tipo, nonce, timestamp };
    } catch {
      return null;
    }
  }

  getAuthEventKey(): string {
    return AUTH_EVENT_KEY;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3) return null;

    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  private isJwtExpired(token: string): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload) return false;

    const exp = Number(payload['exp']);
    if (!Number.isFinite(exp) || exp <= 0) return false;

    return Date.now() >= exp * 1000;
  }

  getUser(): SessionUser | null {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      return null;
    }
  }

  saveUser(user: SessionUser): void {
    const sanitized = this.sanitizeUser(user);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sanitized));
    sessionStorage.setItem(SESSION_FINGERPRINT_KEY, this.buildFingerprint());
    this.registrarNonceSesion();
  }

  clearUser(broadcast = true): void {
    sessionStorage.removeItem(SESSION_KEY);
    const nonce = this.getNonceSesion();
    sessionStorage.removeItem(SESSION_NONCE_KEY);
    sessionStorage.removeItem(SESSION_FINGERPRINT_KEY);

    if (broadcast) {
      this.emitirEvento('logout', nonce || null);
    }
  }

  isAuthenticated(): boolean {
    const user = this.getUser();
    if (!user) return false;

    const storedFingerprint = String(sessionStorage.getItem(SESSION_FINGERPRINT_KEY) ?? '').trim();
    if (storedFingerprint && storedFingerprint !== this.buildFingerprint()) {
      this.clearUser(false);
      return false;
    }

    const token = this.getToken();
    if (!token) return false;

    if (this.isJwtExpired(token)) {
      this.clearUser(false);
      return false;
    }

    return true;
  }

  getToken(): string | null {
    const user = this.getUser();
    const token = String(user?.jwt ?? user?.token ?? '').trim();
    return token || null;
  }

  getRoleId(): number {
    const user = this.getUser();
    return Number(user?.rol?.idRol ?? user?.idRol ?? user?.rolId ?? 0);
  }
}