import { NgModule } from '@angular/core';
import { AdministradorComponent } from './administrador/administrador.component';
import { SupervisorDashboardComponent } from './supervisor/supervisor.component';

@NgModule({
  imports: [AdministradorComponent, SupervisorDashboardComponent],
  exports: [AdministradorComponent, SupervisorDashboardComponent],
})
export class DashboardRoleViewsModule {}
