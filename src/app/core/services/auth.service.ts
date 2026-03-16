import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'https://api.sisferahub.com/api/auth';

  constructor(private http: HttpClient) { }

  login(data: { codigo: string; password: string }): Observable<any> {
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