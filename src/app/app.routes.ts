import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login';
import { SupervisorDashboardComponent } from '../supervisor/supervisor-dashboard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', redirectTo: 'supervisor', pathMatch: 'full' },
  { path: 'supervisor', component: SupervisorDashboardComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
