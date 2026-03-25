import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { UsuariosService } from '../../core/services/usuarios.service';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

type Seccion = 'list' | 'crear-vendedor' | 'crear-supervisor' | 'editar-vendedor' | 'editar-supervisor';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.css'],
})
export class GestionUsuariosComponent implements OnInit, OnDestroy {
  private usuariosService = inject(UsuariosService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // Estado del sidebar
  isSidebarCollapsed = false;

  // Sección activa
  seccionActiva: Seccion = 'list';

  // Listas
  vendedores: any[] = [];
  supervisores: any[] = [];

  // Estados de carga
  cargandoVendedores = false;
  cargandoSupervisores = false;
  guardando = false;
  eliminando = false;

  // Para edición
  usuarioEnEdicion: any = null;
  vendedorEnEdicion: any = null;

  // Formularios
  formVendedor = {
    nombre: '',
    email: '',
    codigo: '',
    ciudad: '',
    username: '',
    password: '',
  };

  formSupervisor = {
    nombre: '',
    email: '',
    username: '',
    password: '',
  };

  ngOnInit(): void {
    this.cargarVendedores();
    this.cargarSupervisores();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============ SIDEBAR ============
  onToggleSidebar(isCollapsed: boolean): void {
    this.isSidebarCollapsed = isCollapsed;
  }

  toggleMenuMovil(): void {
    // Método vacío para compatibilidad si se necesita en el layout
  }

  logout(): void {
    sessionStorage.removeItem('vendedor');
    window.location.href = '/login';
  }

  // ============ CARGA DE DATOS ============
  private cargarVendedores(): void {
    this.cargandoVendedores = true;
    forkJoin({
      usuarios: this.usuariosService.listarVendedores(),
      detalleVendedores: this.usuariosService.listarDetalleVendedores(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ usuarios, detalleVendedores }: { usuarios: any[]; detalleVendedores: any[] }) => {
          const usuariosVendedores = Array.isArray(usuarios)
            ? usuarios.filter((u: any) => {
                const rol = u?.id_rol ?? u?.rol?.idRol ?? u?.idRol ?? 0;
                return Number(rol) === 3;
              })
            : [];

          const detallePorIdUsuario = new Map<number, any>();
          const detallePorCodigo = new Map<string, any>();

          (Array.isArray(detalleVendedores) ? detalleVendedores : []).forEach((detalle: any) => {
            const idUsuario = Number(detalle?.id_usuario ?? detalle?.idUsuario ?? NaN);
            const codigo = String(
              detalle?.codigo_vendedor ?? detalle?.codVendedor ?? detalle?.codigo ?? '',
            ).trim();

            if (!Number.isNaN(idUsuario)) {
              detallePorIdUsuario.set(idUsuario, detalle);
            }
            if (codigo) {
              detallePorCodigo.set(codigo, detalle);
            }
          });

          this.vendedores = usuariosVendedores.map((usuario: any) => {
            const idUsuario = Number(usuario?.id_usuario ?? usuario?.id ?? NaN);
            const codigoUsuario = String(
              usuario?.codigo ?? usuario?.codigo_vendedor ?? usuario?.codVendedor ?? usuario?.username ?? '',
            ).trim();

            const detalleAsociado =
              (!Number.isNaN(idUsuario) ? detallePorIdUsuario.get(idUsuario) : null) ??
              (codigoUsuario ? detallePorCodigo.get(codigoUsuario) : null);

            const codigoAsociado =
              detalleAsociado?.codigo_vendedor ??
              detalleAsociado?.codVendedor ??
              detalleAsociado?.codigo ??
              usuario?.codigo ??
              usuario?.codigo_vendedor ??
              usuario?.codVendedor ??
              usuario?.username ??
              '';

            const nombreAsociado =
              detalleAsociado?.nombre ??
              detalleAsociado?.nom_vendedor ??
              usuario?.nombre ??
              usuario?.nom_vendedor ??
              '';

            return {
              ...usuario,
              nombre: nombreAsociado,
              codigo: String(codigoAsociado).trim(),
              codigo_vendedor: String(codigoAsociado).trim(),
            };
          });

          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar vendedores:', err);
          this.vendedores = [];
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
      });
  }

  private cargarSupervisores(): void {
    this.cargandoSupervisores = true;
    this.usuariosService
      .listarSupervisores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          this.supervisores = Array.isArray(res) ? res : [];
          this.cargandoSupervisores = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar supervisores:', err);
          this.supervisores = [];
          this.cargandoSupervisores = false;
          this.cdr.detectChanges();
        },
      });
  }

  // ============ NAVEGACIÓN ============
  irACrearVendedor(): void {
    this.seccionActiva = 'crear-vendedor';
    this.limpiarFormVendedor();
  }

  irACrearSupervisor(): void {
    this.seccionActiva = 'crear-supervisor';
    this.limpiarFormSupervisor();
  }

  irAEditarVendedor(vendedor: any): void {
    this.vendedorEnEdicion = vendedor;
    this.usuarioEnEdicion = vendedor; // El usuario es el mismo objeto
    this.formVendedor = {
      nombre: vendedor?.nombre ?? '',
      email: vendedor?.email ?? vendedor?.username ?? '',
      codigo: vendedor?.codigo ?? vendedor?.codigo_vendedor ?? '',
      ciudad: vendedor?.ciudad ?? '',
      username: vendedor?.username ?? '',
      password: '', // No enviamos password en edición
    };
    this.seccionActiva = 'editar-vendedor';
  }

  irAEditarSupervisor(supervisor: any): void {
    this.usuarioEnEdicion = supervisor;
    this.formSupervisor = {
      nombre: supervisor?.nombre ?? supervisor?.username ?? '',
      email: supervisor?.email ?? '',
      username: supervisor?.username ?? '',
      password: '',
    };
    this.seccionActiva = 'editar-supervisor';
  }

  volverALista(): void {
    this.seccionActiva = 'list';
    this.usuarioEnEdicion = null;
    this.vendedorEnEdicion = null;
  }

  // ============ CREAR VENDEDOR ============
  crearVendedor(): void {
    if (!this.validarFormVendedor()) {
      return;
    }

    this.guardando = true;

    const datosUsuario = {
      username: this.formVendedor.username.trim(),
      password: this.formVendedor.password.trim(),
      id_rol: 3, // Vendedor
      estado: true,
    };

    this.usuariosService
      .crearUsuario(datosUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuarioCreado: any) => {
          // Ahora crear el registro de vendedor
          const idUsuario = usuarioCreado?.id_usuario ?? usuarioCreado?.id;

          const datosVendedor = {
            codigo_vendedor: this.formVendedor.codigo.trim(),
            nombre: this.formVendedor.nombre.trim(),
            id_usuario: idUsuario,
          };

          this.usuariosService
            .crearVendedor(datosVendedor)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.guardando = false;
                this.limpiarFormVendedor();
                this.cargarVendedores();
                this.cdr.detectChanges();
                alert('Vendedor creado exitosamente');
                this.volverALista();
              },
              error: (err) => {
                console.error('Error creando vendedor:', err);
                this.guardando = false;
                alert('Error al crear vendedor: ' + err?.error?.message || err?.message);
                this.cdr.detectChanges();
              },
            });
        },
        error: (err) => {
          console.error('Error creando usuario:', err);
          this.guardando = false;
          alert('Error al crear usuario: ' + err?.error?.message || err?.message);
          this.cdr.detectChanges();
        },
      });
  }

  // ============ CREAR SUPERVISOR ============
  crearSupervisor(): void {
    if (!this.validarFormSupervisor()) {
      return;
    }

    this.guardando = true;

    const payload = {
      username: this.formSupervisor.username.trim(),
      password: this.formSupervisor.password.trim(),
      id_rol: 2, // Supervisor
      estado: true,
    };

    this.usuariosService
      .crearUsuario(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardando = false;
          this.limpiarFormSupervisor();
          this.cargarSupervisores();
          this.cdr.detectChanges();
          alert('Supervisor creado exitosamente');
          this.volverALista();
        },
        error: (err) => {
          console.error('Error creando supervisor:', err);
          this.guardando = false;
          alert('Error al crear supervisor: ' + err?.error?.message || err?.message);
          this.cdr.detectChanges();
        },
      });
  }

  // ============ ACTUALIZAR VENDEDOR ============
  actualizarVendedor(): void {
    if (!this.validarFormVendedor()) {
      return;
    }

    this.guardando = true;

    const idUsuario = this.usuarioEnEdicion?.id_usuario ?? this.usuarioEnEdicion?.id;

    // Actualizar usuario
    const datosUsuario: any = {
      username: this.formVendedor.username.trim(),
    };

    if (this.formVendedor.password.trim()) {
      datosUsuario.password = this.formVendedor.password.trim();
    }

    this.usuariosService
      .actualizarUsuario(idUsuario, datosUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Actualizar vendedor si tiene ID
          if (this.vendedorEnEdicion?.id_vendedor || this.vendedorEnEdicion?.id) {
            const idVendedor = this.vendedorEnEdicion?.id_vendedor ?? this.vendedorEnEdicion?.id;

            const datosVendedor = {
              codigo_vendedor: this.formVendedor.codigo.trim(),
              nombre: this.formVendedor.nombre.trim(),
            };

            this.usuariosService
              .actualizarVendedor(idVendedor, datosVendedor)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.guardando = false;
                  this.cargarVendedores();
                  this.cdr.detectChanges();
                  alert('Vendedor actualizado exitosamente');
                  this.volverALista();
                },
                error: (err) => {
                  console.error('Error actualizando vendedor:', err);
                  this.guardando = false;
                  alert('Error al actualizar vendedor');
                  this.cdr.detectChanges();
                },
              });
          } else {
            this.guardando = false;
            this.cargarVendedores();
            this.cdr.detectChanges();
            alert('Vendedor actualizado exitosamente');
            this.volverALista();
          }
        },
        error: (err) => {
          console.error('Error actualizando usuario:', err);
          this.guardando = false;
          alert('Error al actualizar usuario');
          this.cdr.detectChanges();
        },
      });
  }

  // ============ ACTUALIZAR SUPERVISOR ============
  actualizarSupervisor(): void {
    if (!this.validarFormSupervisor()) {
      return;
    }

    this.guardando = true;

    const idUsuario = this.usuarioEnEdicion?.id_usuario ?? this.usuarioEnEdicion?.id;

    const datos: any = {
      username: this.formSupervisor.username.trim(),
    };

    if (this.formSupervisor.password.trim()) {
      datos.password = this.formSupervisor.password.trim();
    }

    this.usuariosService
      .actualizarUsuario(idUsuario, datos)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardando = false;
          this.cargarSupervisores();
          this.cdr.detectChanges();
          alert('Supervisor actualizado exitosamente');
          this.volverALista();
        },
        error: (err) => {
          console.error('Error actualizando supervisor:', err);
          this.guardando = false;
          alert('Error al actualizar supervisor');
          this.cdr.detectChanges();
        },
      });
  }

  // ============ DESACTIVAR USUARIO ============
  desactivarVendedor(vendedor: any): void {
    if (!confirm(`¿Desactivar vendedor ${vendedor?.nombre}?`)) {
      return;
    }

    this.eliminando = true;

    const idUsuario = vendedor?.id_usuario ?? vendedor?.id;

    this.usuariosService
      .desactivarUsuario(idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;
          this.cargarVendedores();
          this.cdr.detectChanges();
          alert('Vendedor desactivado exitosamente');
        },
        error: (err) => {
          console.error('Error desactivando vendedor:', err);
          this.eliminando = false;
          alert('Error al desactivar vendedor');
          this.cdr.detectChanges();
        },
      });
  }

  desactivarSupervisor(supervisor: any): void {
    if (!confirm(`¿Desactivar supervisor ${supervisor?.nombre}?`)) {
      return;
    }

    this.eliminando = true;

    const idUsuario = supervisor?.id_usuario ?? supervisor?.id;

    this.usuariosService
      .desactivarUsuario(idUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;
          this.cargarSupervisores();
          this.cdr.detectChanges();
          alert('Supervisor desactivado exitosamente');
        },
        error: (err) => {
          console.error('Error desactivando supervisor:', err);
          this.eliminando = false;
          alert('Error al desactivar supervisor');
          this.cdr.detectChanges();
        },
      });
  }

  // ============ VALIDACIONES ============
  private validarFormVendedor(): boolean {
    const { nombre, codigo, username, password } = this.formVendedor;
    if (!nombre.trim() || !codigo.trim() || !username.trim() || !password.trim()) {
      alert('Por favor completa todos los campos obligatorios');
      return false;
    }
    return true;
  }

  private validarFormSupervisor(): boolean {
    const { nombre, username, password } = this.formSupervisor;
    if (!nombre.trim() || !username.trim() || !password.trim()) {
      alert('Por favor completa todos los campos obligatorios');
      return false;
    }
    return true;
  }

  // ============ LIMPIAR FORMULARIOS ============
  private limpiarFormVendedor(): void {
    this.formVendedor = {
      nombre: '',
      email: '',
      codigo: '',
      ciudad: '',
      username: '',
      password: '',
    };
  }

  private limpiarFormSupervisor(): void {
    this.formSupervisor = {
      nombre: '',
      email: '',
      username: '',
      password: '',
    };
  }
}
