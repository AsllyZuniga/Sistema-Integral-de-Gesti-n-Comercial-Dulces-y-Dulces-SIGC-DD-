import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';
import { RoleGuard } from './core/guards/role.guard';
import { ADMIN_ROLES, ANALISIS_ROLES, DASHBOARD_ROLES } from './core/auth/roles';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginGuard],
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [RoleGuard],
    data: { roles: DASHBOARD_ROLES },
  },
  {
    path: 'impactos',
    loadComponent: () =>
      import('./features/dashboard/components/impactos/impactos.component').then(
        (m) => m.ImpactosComponent,
      ),
    canActivate: [RoleGuard],
    data: { roles: ANALISIS_ROLES },
  },
  {
    path: 'vendedor-items',
    loadChildren: () =>
      import('./features/vendedor-items/vendedor-items.routes').then(
        (m) => m.VENDEDOR_ITEMS_ROUTES,
      ),
    canActivate: [RoleGuard],
    data: { roles: ANALISIS_ROLES },
  },
  {
    path: 'carga',
    loadComponent: () => import('./features/carga/carga.component').then((m) => m.CargaComponent),
    canActivate: [RoleGuard],
    data: { roles: ADMIN_ROLES },
  },
  {
    path: 'carga-cuotas',
    loadComponent: () =>
      import('./features/carga/carga-cuotas/carga-cuotas.component').then(
        (m) => m.CargaCuotasComponent,
      ),
    canActivate: [RoleGuard],
    data: { roles: ADMIN_ROLES },
  },
  {
    path: 'gestion-usuarios',
    loadComponent: () =>
      import('./features/gestion-usuarios/gestion-usuarios.component').then(
        (m) => m.GestionUsuariosComponent,
      ),
    canActivate: [RoleGuard],
    data: { roles: ADMIN_ROLES },
  },
  { path: '**', redirectTo: 'login' },
];
