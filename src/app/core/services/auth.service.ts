import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:3000/api/auth';

  constructor(private http: HttpClient) {}

  // ✅ Acepta codigo (vendedores) o username (admins/supervisores sin vendedor)
  login(data: { codigo?: string; username?: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  getVendedor() {
    return JSON.parse(localStorage.getItem('vendedor') || 'null');
  }

  logout() {
    localStorage.removeItem('vendedor');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('vendedor');
  }
}