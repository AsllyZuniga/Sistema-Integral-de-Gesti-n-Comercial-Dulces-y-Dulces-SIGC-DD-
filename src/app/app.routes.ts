import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CargaComponent } from './features/carga/carga.component';
import { CargaCuotasComponent } from './features/carga/carga-cuotas/carga-cuotas.component';
import { GestionUsuariosComponent } from './features/gestion-usuarios/gestion-usuarios.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { RoleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginGuard]
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'carga',
    component: CargaComponent,
    canActivate: [RoleGuard],
    data: { roles: [1] }
  },
  {
    path: 'carga-cuotas',
    component: CargaCuotasComponent,
    canActivate: [RoleGuard],
    data: { roles: [1] }
  },
  {
    path: 'gestion-usuarios',
    component: GestionUsuariosComponent,
    canActivate: [RoleGuard],
    data: { roles: [1] }
  },
  { path: '**', redirectTo: 'login' }
];