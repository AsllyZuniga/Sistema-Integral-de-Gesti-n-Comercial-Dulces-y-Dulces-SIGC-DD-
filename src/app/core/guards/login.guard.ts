import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class LoginGuard implements CanActivate {
  canActivate(): boolean {
    // Se permite abrir /login aun estando autenticado para forzar revalidación manual.
    // También evita bucles cuando una ruta protegida redirige a /login.
    return true;
  }
}
