import { Component, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { SessionService } from '../../../core/services/session.service';
import { CuotaVendedorUploadComponent } from './cuota-vendedor-upload/cuota-vendedor-upload.component';
import { CuotaProveedorUploadComponent } from './cuota-proveedor-upload/cuota-proveedor-upload.component';
import { CuotaCategoriaUploadComponent } from './cuota-categoria-upload/cuota-categoria-upload.component';

@Component({
  selector: 'app-carga-cuotas',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    CuotaVendedorUploadComponent,
    CuotaProveedorUploadComponent,
    CuotaCategoriaUploadComponent,
  ],
  templateUrl: './carga-cuotas.component.html',
  styleUrls: ['./carga-cuotas.component.css'],
})
export class CargaCuotasComponent {
  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  sidebarColapsado = false;

  constructor(
    private cd: ChangeDetectorRef,
    private session: SessionService,
  ) {}

  onToggleSidebar(colapsado: boolean): void {
    this.sidebarColapsado = colapsado;
    this.cd.detectChanges();
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  logout(): void {
    this.session.clearUser();
    window.location.href = '/login';
  }
}
