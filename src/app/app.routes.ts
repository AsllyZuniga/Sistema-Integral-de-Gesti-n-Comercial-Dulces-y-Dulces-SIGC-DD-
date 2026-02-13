import { Routes } from '@angular/router';
import { LoginComponent } from '../login/login';
import { SupervisorDashboardComponent } from '../supervisor/supervisor-dashboard';
import { VentasComponent } from '../supervisor/ventas/ventas';
import { DevolucionesComponent } from '../supervisor/devoluciones/devoluciones';
import { ImpactosComponent } from '../supervisor/impactos/impactos';
import { HistoricosComponent } from '../supervisor/historicos/historicos';
import { AgotadosComponent } from '../supervisor/agotados/agotados';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'home', redirectTo: 'supervisor', pathMatch: 'full' },
  { path: 'supervisor', component: SupervisorDashboardComponent },
  { path: 'supervisor/ventas', component: VentasComponent },
  { path: 'supervisor/devoluciones', component: DevolucionesComponent },
  { path: 'supervisor/impactos', component: ImpactosComponent },
  { path: 'supervisor/historicos', component: HistoricosComponent },
  { path: 'supervisor/agotados', component: AgotadosComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
