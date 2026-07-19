import { Component, OnInit, OnDestroy, ViewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  VendedoresTableComponent,
  VendedorTabla,
} from '../dashboard/views/shared/vendedores-table/vendedores-table.component';
import { UsuariosService } from '../../core/services/usuarios.service';
import { AuthService } from '../../core/services/auth.service';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';

type Seccion =
  | 'list'
  | 'crear-vendedor'
  | 'crear-supervisor'
  | 'crear-administrador'
  | 'editar-vendedor'
  | 'editar-supervisor'
  | 'editar-administrador';

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, TopbarComponent, VendedoresTableComponent],
  templateUrl: './gestion-usuarios.component.html',
  styleUrls: ['./gestion-usuarios.component.css'],
})
export class GestionUsuariosComponent implements OnInit, OnDestroy {
  private usuariosService = inject(UsuariosService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @ViewChild(SidebarComponent) sidebarRef?: SidebarComponent;

  // Estado del sidebar
  isSidebarCollapsed = false;

  // Sección activa
  seccionActiva: Seccion = 'list';

  // Listas
  vendedores: any[] = [];
  supervisores: any[] = [];
  administradores: any[] = [];
  vendedoresDelSupervisor: Map<string | number, any[]> = new Map();

  // Modal para asignar supervisor desde el botón azul de la tabla
  showAsignarSupervisorModal = false;
  vendedorAsignacion: any = null;
  supervisorSeleccionado = '';
  asignandoSupervisor = false;

  // Búsqueda de vendedores (con debounce, ya que el filtrado corre en memoria
  // sobre potencialmente miles de filas y no conviene recalcular en cada tecla)
  busquedaVendedorInput = '';
  private busquedaVendedorTermino = '';
  private busquedaVendedor$ = new Subject<string>();

  // Secciones colapsables (<details>): se colapsan por defecto solo cuando
  // hay más de 5 usuarios, para no montar cientos/miles de filas de una.
  // El valor es null hasta que el usuario interactúa manualmente (toggle);
  // mientras sea null, se usa el default basado en el tamaño de la lista.
  private seccionAbiertaManual: Record<'vendedores' | 'supervisores' | 'administradores', boolean | null> = {
    vendedores: null,
    supervisores: null,
    administradores: null,
  };

  private readonly UMBRAL_COLAPSO = 5;

  seccionEstaAbierta(seccion: 'vendedores' | 'supervisores' | 'administradores'): boolean {
    const manual = this.seccionAbiertaManual[seccion];
    if (manual !== null) return manual;

    // Vendedores siempre inicia contraída por defecto, sin importar la
    // cantidad; el usuario puede expandirla manualmente con el toggle.
    if (seccion === 'vendedores') return false;

    const total = seccion === 'supervisores' ? this.supervisores.length : this.administradores.length;

    return total <= this.UMBRAL_COLAPSO;
  }

  onToggleSeccion(seccion: 'vendedores' | 'supervisores' | 'administradores', abierta: boolean): void {
    this.seccionAbiertaManual[seccion] = abierta;
  }

  // Vista en forma de tabla para gestión
  get vendedoresTabla(): VendedorTabla[] {
    const filas = (this.vendedores ?? []).map((v: any) => ({
      codigo_vendedor:
        v?.codigo_vendedor ?? v?.codigo ?? v?.codVendedor ?? v?.codigo_vendedor ?? v?.codigo,
      codVendedor: v?.codigo ?? v?.codVendedor ?? v?.codigo_vendedor ?? v?.codigo,
      id_usuario: v?.id_usuario ?? v?.idUsuario ?? v?.usuario?.id_usuario ?? v?.usuario?.id ?? null,
      id_vendedor: v?.id_vendedor ?? v?.idVendedor ?? v?.id ?? null,
      nombre: v?.nombre ?? v?.nom_vendedor ?? v?.username ?? '',
      nombreSupervisor:
        v?.nombreSupervisor ?? v?.supervisor?.nombre ?? v?.supervisor?.username ?? '',
      id_supervisor: v?.id_supervisor ?? v?.idSupervisor ?? v?.supervisor?.id ?? null,
      estado: v?.estado ?? true,
    }));

    const termino = this.busquedaVendedorTermino.trim().toLowerCase();
    const filtradas = termino
      ? filas.filter((v) =>
          [v.codVendedor, v.nombre, v.codigo_vendedor]
            .map((campo) => String(campo ?? '').toLowerCase())
            .some((campo) => campo.includes(termino)),
        )
      : filas;

    return filtradas.sort((a, b) => this.compararPorCodigo(a.codVendedor, b.codVendedor));
  }

  // Estados de carga
  cargandoVendedores = false;
  cargandoSupervisores = false;
  cargandoAdministradores = false;
  guardando = false;
  eliminando = false;
  mensajeOperacion: string | null = null;
  tipoOperacion: 'success' | 'error' | null = null;

  // Para edición
  usuarioEnEdicion: any = null;
  vendedorEnEdicion: any = null;

  // Para expandir/contraer vendedores por supervisor
  supervisoresExpandidos: Set<string | number> = new Set();

  // Formularios
  formVendedor = {
    nombre: '',
    email: '',
    codigo: '',
    ciudad: '',
    username: '',
    password: '',
    id_supervisor: '',
  };

  formSupervisor = {
    nombre: '',
    email: '',
    username: '',
    password: '',
  };

  formAdministrador = {
    nombre: '',
    username: '',
    password: '',
  };

  ngOnInit(): void {
    this.cargarVendedores();
    this.cargarSupervisores();
    this.cargarAdministradores();

    this.busquedaVendedor$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((termino) => {
        this.busquedaVendedorTermino = termino;
        this.cdr.detectChanges();
      });
  }

  onBuscarVendedor(valor: string): void {
    this.busquedaVendedor$.next(valor);
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
    this.sidebarRef?.toggleMobile();
  }

  logout(): void {
    this.auth.logout();
  }

  private notificar(tipo: 'success' | 'error', mensaje: string): void {
    this.tipoOperacion = tipo;
    this.mensajeOperacion = mensaje;
    this.cdr.detectChanges();
  }

  private normalizarTexto(value: any): string {
    return String(value ?? '').trim();
  }

  private normalizarCodigo(value: any): string {
    return String(value ?? '').trim();
  }

  private codigoSinCeros(value: any): string {
    const codigo = this.normalizarCodigo(value);
    if (!codigo) return '';
    const sinCeros = codigo.replace(/^0+/, '');
    return sinCeros || '0';
  }

  private compararPorCodigo(codigoA: any, codigoB: any): number {
    const textoA = this.normalizarCodigo(codigoA);
    const textoB = this.normalizarCodigo(codigoB);

    const numeroA = Number(this.codigoSinCeros(textoA));
    const numeroB = Number(this.codigoSinCeros(textoB));

    if (!Number.isNaN(numeroA) && !Number.isNaN(numeroB) && textoA !== '' && textoB !== '') {
      if (numeroA !== numeroB) return numeroA - numeroB;
    }

    return textoA.localeCompare(textoB, undefined, { numeric: true, sensitivity: 'base' });
  }

  private getIdSupervisor(supervisor: any): string | number | null {
    return supervisor?.id_usuario ?? supervisor?.id ?? supervisor?.idSupervisor ?? null;
  }

  private getNombreSupervisor(supervisor: any): string {
    return (
      [
        supervisor?.nombre,
        supervisor?.nom_supervisor,
        supervisor?.usuario?.nombre,
        supervisor?.username,
      ]
        .map((v) => String(v ?? '').trim())
        .find((v) => v.length > 0) ?? ''
    );
  }

  private getIdVendedor(vendedor: any): string | number | null {
    return vendedor?.id_vendedor ?? vendedor?.idVendedor ?? vendedor?.id ?? null;
  }

  private getCodigoVendedor(vendedor: any): string {
    return this.normalizarCodigo(
      vendedor?.codigo ??
        vendedor?.codigo_vendedor ??
        vendedor?.codVendedor ??
        vendedor?.username ??
        vendedor?.usuario?.username ??
        '',
    );
  }

  private getNombreVendedor(vendedor: any): string {
    return (
      [
        vendedor?.nombre,
        vendedor?.nom_vendedor,
        vendedor?.nombre_vendedor,
        vendedor?.vendedor?.nombre,
        vendedor?.usuario?.nombre,
        vendedor?.username,
      ]
        .map((v) => String(v ?? '').trim())
        .find((v) => v.length > 0) ?? ''
    );
  }

  private sonMismoVendedor(a: any, b: any): boolean {
    const idA = this.getIdVendedor(a);
    const idB = this.getIdVendedor(b);

    if (idA != null && idB != null && String(idA) === String(idB)) {
      return true;
    }

    const codigoA = this.getCodigoVendedor(a);
    const codigoB = this.getCodigoVendedor(b);

    if (codigoA && codigoB && codigoA === codigoB) {
      return true;
    }

    const codigoA2 = this.codigoSinCeros(codigoA);
    const codigoB2 = this.codigoSinCeros(codigoB);

    return !!codigoA2 && !!codigoB2 && codigoA2 === codigoB2;
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

          const obtenerNombre = (item: any): string => {
            return String(
              item?.nombre ??
                item?.nom_vendedor ??
                item?.nombre_vendedor ??
                item?.vendedor?.nombre ??
                item?.usuario?.nombre ??
                '',
            ).trim();
          };

          const obtenerCodigo = (item: any): string => {
            return this.normalizarCodigo(
              item?.codigo_vendedor ??
                item?.codVendedor ??
                item?.codigo ??
                item?.vendedor?.codigo_vendedor ??
                item?.vendedor?.codVendedor ??
                item?.vendedor?.codigo ??
                item?.usuario?.codigo ??
                item?.usuario?.username ??
                '',
            );
          };

          const detallePorIdUsuario = new Map<string, any>();
          const detallePorCodigo = new Map<string, any>();

          (Array.isArray(detalleVendedores) ? detalleVendedores : []).forEach((detalle: any) => {
            const idUsuario = String(
              detalle?.id_usuario ??
                detalle?.idUsuario ??
                detalle?.usuario?.id_usuario ??
                detalle?.usuario?.id ??
                '',
            ).trim();

            const codigo = obtenerCodigo(detalle);
            const codigoNormalizado = this.codigoSinCeros(codigo);

            if (idUsuario) {
              detallePorIdUsuario.set(idUsuario, detalle);
            }

            if (codigo) {
              detallePorCodigo.set(codigo, detalle);
            }

            if (codigoNormalizado) {
              detallePorCodigo.set(codigoNormalizado, detalle);
            }
          });

          this.vendedores = usuariosVendedores.map((usuario: any) => {
            const idUsuario = String(usuario?.id_usuario ?? usuario?.id ?? '').trim();

            const codigoUsuario = String(
              usuario?.codigo ??
                usuario?.codigo_vendedor ??
                usuario?.codVendedor ??
                usuario?.username ??
                '',
            ).trim();

            const codigoUsuarioNormalizado = this.codigoSinCeros(codigoUsuario);

            const detalleAsociado =
              (idUsuario ? detallePorIdUsuario.get(idUsuario) : null) ??
              (codigoUsuario ? detallePorCodigo.get(codigoUsuario) : null) ??
              (codigoUsuarioNormalizado ? detallePorCodigo.get(codigoUsuarioNormalizado) : null);

            const idVendedorAsociado =
              detalleAsociado?.id_vendedor ?? detalleAsociado?.idVendedor ?? null;

            const idSupervisorAsociado =
              detalleAsociado?.id_supervisor ??
              detalleAsociado?.idSupervisor ??
              detalleAsociado?.supervisor?.id_usuario ??
              detalleAsociado?.supervisor?.id ??
              usuario?.id_supervisor ??
              usuario?.idSupervisor ??
              usuario?.supervisor?.id_usuario ??
              usuario?.supervisor?.id ??
              null;

            const nombreSupervisorAsociado =
              detalleAsociado?.nombreSupervisor ??
              detalleAsociado?.supervisor?.nombre ??
              detalleAsociado?.supervisor?.username ??
              usuario?.nombreSupervisor ??
              usuario?.supervisor?.nombre ??
              usuario?.supervisor?.username ??
              '';

            const codigoAsociado =
              [
                obtenerCodigo(detalleAsociado),
                usuario?.codigo,
                usuario?.codigo_vendedor,
                usuario?.codVendedor,
                usuario?.username,
                usuario?.usuario?.username,
              ]
                .map((v) => String(v ?? '').trim())
                .find((v) => v.length > 0) ?? '';

            const nombreAsociado =
              [
                obtenerNombre(detalleAsociado),
                usuario?.nombre,
                usuario?.nom_vendedor,
                usuario?.nombre_vendedor,
                usuario?.vendedor?.nombre,
                usuario?.username,
                usuario?.usuario?.username,
              ]
                .map((v) => String(v ?? '').trim())
                .find((v) => v.length > 0) ?? '';

            return {
              ...usuario,
                id_usuario: usuario?.id_usuario ?? usuario?.id ?? null,
              nombre: nombreAsociado,
              codigo: String(codigoAsociado).trim(),
              codigo_vendedor: String(codigoAsociado).trim(),
              id_vendedor: idVendedorAsociado,
              id_supervisor: idSupervisorAsociado,
              nombreSupervisor: nombreSupervisorAsociado,
              estado: usuario?.estado ?? detalleAsociado?.estado ?? true,
            };
          });

          this.cargandoVendedores = false;
          this.sincronizarVendedoresConMapaSupervisores();
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
          this.supervisores = Array.isArray(res)
            ? res.map((supervisor: any) => {
                const nombreAsociado = this.getNombreSupervisor(supervisor);

                return {
                  ...supervisor,
                  nombre: nombreAsociado,
                };
              })
            : [];

          const supervisorList = this.supervisores;

          if (supervisorList.length === 0) {
            this.vendedoresDelSupervisor.clear();
            this.cargandoSupervisores = false;
            this.cdr.detectChanges();
            return;
          }

          const calls = supervisorList.map((supervisor) =>
            this.usuariosService
              .obtenerVendedoresDelSupervisor(String(supervisor.id_usuario ?? supervisor.id))
              .pipe(catchError(() => of([]))),
          );

          forkJoin(calls)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (results: any[]) => {
                this.vendedoresDelSupervisor.clear();

                results.forEach((vendedores: any[], idx: number) => {
                  const supervisor = supervisorList[idx];
                  const idSupervisor = supervisor?.id_usuario ?? supervisor?.id;

                  this.vendedoresDelSupervisor.set(idSupervisor, vendedores ?? []);

                  (vendedores ?? []).forEach((v: any) => {
                    const codigo = String(
                      v?.codigo_vendedor ??
                        v?.codVendedor ??
                        v?.codigo ??
                        v?.username ??
                        v?.usuario?.username ??
                        '',
                    ).trim();

                    const codigoNormalizado = this.codigoSinCeros(codigo);

                    const encontrado = this.vendedores.find((vv: any) => {
                      const codigoV = String(
                        vv?.codigo ?? vv?.codigo_vendedor ?? vv?.codVendedor ?? vv?.username ?? '',
                      ).trim();

                      return (
                        codigoV === codigo || this.codigoSinCeros(codigoV) === codigoNormalizado
                      );
                    });

                    if (encontrado) {
                      encontrado.nombreSupervisor =
                        supervisor?.nombre ??
                        supervisor?.nom_supervisor ??
                        supervisor?.username ??
                        '';
                      encontrado.id_supervisor = idSupervisor;
                    }
                  });
                });

                this.cargandoSupervisores = false;
                this.cdr.detectChanges();
              },
              error: (err) => {
                console.error('Error cargando vendedores de supervisores:', err);
                this.cargandoSupervisores = false;
                this.cdr.detectChanges();
              },
            });
        },
        error: (err) => {
          console.error('Error al cargar supervisores:', err);
          this.supervisores = [];
          this.cargandoSupervisores = false;
          this.cdr.detectChanges();
        },
      });
  }

  private cargarVendedoresDelSupervisor(idSupervisor: string | number): void {
    this.usuariosService
      .obtenerVendedoresDelSupervisor(String(idSupervisor))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vendedores: any[]) => {
          this.vendedoresDelSupervisor.set(idSupervisor, vendedores ?? []);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(`Error cargando vendedores del supervisor ${idSupervisor}:`, err);
          this.vendedoresDelSupervisor.set(idSupervisor, []);
          this.cdr.detectChanges();
        },
      });
  }

  private cargarAdministradores(): void {
    this.cargandoAdministradores = true;

    this.usuariosService
      .listarAdministradores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          this.administradores = Array.isArray(res)
            ? res.map((admin: any) => ({
                ...admin,
                nombre: admin?.nombre ?? admin?.username ?? '',
              }))
            : [];

          this.cargandoAdministradores = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar administradores:', err);
          this.administradores = [];
          this.cargandoAdministradores = false;
          this.cdr.detectChanges();
        },
      });
  }

  private recargarGestionUsuarios(): void {
    this.cargarVendedores();
    this.cargarSupervisores();
    this.cargarAdministradores();
  }

  private sincronizarVendedoresConMapaSupervisores(): void {
    this.vendedoresDelSupervisor.forEach((vendedores, idSupervisor) => {
      const supervisor = this.supervisores.find(
        (s) => String(this.getIdSupervisor(s)) === String(idSupervisor),
      );

      const nombreSupervisor = this.getNombreSupervisor(supervisor);

      (vendedores ?? []).forEach((vendedorAsignado: any) => {
        const vendedorLocal = this.vendedores.find((v: any) =>
          this.sonMismoVendedor(v, vendedorAsignado),
        );

        if (vendedorLocal) {
          vendedorLocal.id_supervisor = idSupervisor;
          vendedorLocal.nombreSupervisor = nombreSupervisor;
        }
      });
    });
  }

  private actualizarAsignacionLocal(vendedor: any, idSupervisorNuevo: string | number): void {
    const supervisorNuevo = this.supervisores.find(
      (s: any) => String(this.getIdSupervisor(s)) === String(idSupervisorNuevo),
    );

    const nombreSupervisorNuevo = this.getNombreSupervisor(supervisorNuevo);

    const vendedorActualizado = {
      ...vendedor,
      id_supervisor: idSupervisorNuevo,
      idSupervisor: idSupervisorNuevo,
      nombreSupervisor: nombreSupervisorNuevo,
    };

    const vendedorEnLista = this.vendedores.find((v: any) => this.sonMismoVendedor(v, vendedor));

    if (vendedorEnLista) {
      vendedorEnLista.id_supervisor = idSupervisorNuevo;
      vendedorEnLista.idSupervisor = idSupervisorNuevo;
      vendedorEnLista.nombreSupervisor = nombreSupervisorNuevo;
    }

    this.vendedoresDelSupervisor.forEach((lista, idSupervisor) => {
      const filtrada = (lista ?? []).filter((v: any) => !this.sonMismoVendedor(v, vendedor));
      this.vendedoresDelSupervisor.set(idSupervisor, filtrada);
    });

    const listaDestino = this.vendedoresDelSupervisor.get(idSupervisorNuevo) ?? [];
    const yaExiste = listaDestino.some((v: any) => this.sonMismoVendedor(v, vendedorActualizado));

    if (!yaExiste) {
      this.vendedoresDelSupervisor.set(idSupervisorNuevo, [...listaDestino, vendedorActualizado]);
    }
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

  irACrearAdministrador(): void {
    this.seccionActiva = 'crear-administrador';
    this.limpiarFormAdministrador();
  }

  irAEditarVendedor(vendedor: any): void {
    this.vendedorEnEdicion = vendedor;
    this.usuarioEnEdicion = vendedor;

    this.formVendedor = {
      nombre: vendedor?.nombre ?? '',
      email: vendedor?.email ?? vendedor?.username ?? '',
      codigo: vendedor?.codigo ?? vendedor?.codigo_vendedor ?? vendedor?.codVendedor ?? '',
      ciudad: vendedor?.ciudad ?? '',
      username: vendedor?.username ?? vendedor?.codigo ?? vendedor?.codigo_vendedor ?? vendedor?.codVendedor ?? '',
      password: '',
      id_supervisor: String(
        vendedor?.id_supervisor ??
          vendedor?.idSupervisor ??
          vendedor?.supervisor?.id_usuario ??
          vendedor?.supervisor?.id ??
          '',
      ),
    };

    this.seccionActiva = 'editar-vendedor';
    this.cdr.detectChanges();
  }

  onAsignarSupervisorDesdeTabla(vendedor: VendedorTabla): void {
    const codigoTabla = String(vendedor.codVendedor ?? vendedor.codigo_vendedor ?? '').trim();
    const codigoTablaSinCeros = this.codigoSinCeros(codigoTabla);

    const encontrado = this.vendedores.find((v: any) => {
      const codigoVendedor = String(v?.codigo ?? v?.codigo_vendedor ?? v?.codVendedor ?? '').trim();

      return (
        codigoVendedor === codigoTabla ||
        this.codigoSinCeros(codigoVendedor) === codigoTablaSinCeros
      );
    });

    this.vendedorAsignacion = encontrado ?? {
      nombre: vendedor.nombre,
      codigo: vendedor.codVendedor ?? vendedor.codigo_vendedor,
      codigo_vendedor: vendedor.codigo_vendedor ?? vendedor.codVendedor,
      id_vendedor: vendedor.id_vendedor,
      id_supervisor: vendedor.id_supervisor ?? '',
      nombreSupervisor: vendedor.nombreSupervisor ?? '',
    };

    this.supervisorSeleccionado = String(
      this.vendedorAsignacion?.id_supervisor ??
        this.vendedorAsignacion?.idSupervisor ??
        this.vendedorAsignacion?.supervisor?.id_usuario ??
        this.vendedorAsignacion?.supervisor?.id ??
        '',
    );

    this.showAsignarSupervisorModal = true;
    this.cdr.detectChanges();
  }

  cerrarAsignarSupervisor(): void {
    if (this.asignandoSupervisor) return;

    this.showAsignarSupervisorModal = false;
    this.vendedorAsignacion = null;
    this.supervisorSeleccionado = '';
    this.cdr.detectChanges();
  }

  guardarAsignacionSupervisor(): void {
    if (!this.vendedorAsignacion) {
      this.notificar('error', 'No se encontró el vendedor seleccionado');
      return;
    }

    if (!this.supervisorSeleccionado) {
      this.notificar('error', 'Seleccione un supervisor');
      return;
    }

    const idVendedor = this.getIdVendedor(this.vendedorAsignacion);

    if (!idVendedor) {
      this.notificar('error', 'No se encontró el ID del vendedor. No se puede asignar supervisor.');
      return;
    }

    this.asignandoSupervisor = true;
    this.cdr.detectChanges();

    this.usuariosService
      .asignarSupervisor(String(idVendedor), String(this.supervisorSeleccionado))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          const idSupervisorNuevo = Number(this.supervisorSeleccionado);
          const vendedorActual = this.vendedorAsignacion;

          const idSupervisorAnterior =
            vendedorActual?.id_supervisor ??
            vendedorActual?.idSupervisor ??
            vendedorActual?.supervisor?.id_usuario ??
            vendedorActual?.supervisor?.id ??
            null;

          this.actualizarAsignacionLocal(vendedorActual, idSupervisorNuevo);

          this.asignandoSupervisor = false;
          this.showAsignarSupervisorModal = false;
          this.vendedorAsignacion = null;
          this.supervisorSeleccionado = '';

          this.notificar('success', 'Supervisor asignado correctamente');

          // Invalida el cache (shareReplay) del supervisor viejo y del nuevo,
          // si no la recarga siguiente sirve datos obsoletos y la asignación
          // optimista de arriba queda pisada al llegar la respuesta real.
          if (idSupervisorAnterior != null) {
            this.usuariosService.invalidarCacheVendedoresPorSupervisor(String(idSupervisorAnterior));
          }
          this.usuariosService.invalidarCacheVendedoresPorSupervisor(String(idSupervisorNuevo));

          // Recarga real desde backend para que el vendedor también aparezca
          // en la lista del supervisor seleccionado.
          this.recargarGestionUsuarios();

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error asignando supervisor:', err);
          this.asignandoSupervisor = false;
          this.notificar(
            'error',
            err?.error?.message ??
              err?.error?.mensaje ??
              err?.message ??
              'Error al asignar supervisor',
          );
          this.cdr.detectChanges();
        },
      });
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

  irAEditarAdministrador(administrador: any): void {
    this.usuarioEnEdicion = administrador;
    this.formAdministrador = {
      nombre: administrador?.nombre ?? administrador?.username ?? '',
      username: administrador?.username ?? '',
      password: '',
    };
    this.seccionActiva = 'editar-administrador';
  }

  volverALista(): void {
    this.seccionActiva = 'list';
    this.usuarioEnEdicion = null;
    this.vendedorEnEdicion = null;
  }

  // ============ EXPANDIR/CONTRAER VENDEDORES POR SUPERVISOR ============
  toggleSupervisorVendedores(idSupervisor: string | number): void {
    if (this.supervisoresExpandidos.has(idSupervisor)) {
      this.supervisoresExpandidos.delete(idSupervisor);
    } else {
      this.supervisoresExpandidos.add(idSupervisor);
      this.cargarVendedoresDelSupervisor(idSupervisor);
    }

    this.cdr.detectChanges();
  }

  esSupervisorExpandido(idSupervisor: string | number): boolean {
    return this.supervisoresExpandidos.has(idSupervisor);
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
      id_rol: 3,
      estado: true,
    };

    this.usuariosService
      .crearUsuario(datosUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuarioCreado: any) => {
          const idUsuario = usuarioCreado?.id_usuario ?? usuarioCreado?.id;

          const datosVendedor: any = {
            codigo_vendedor: this.formVendedor.codigo.trim(),
            nombre: this.formVendedor.nombre.trim(),
            id_usuario: idUsuario,
          };

          if (this.formVendedor.id_supervisor) {
            datosVendedor.id_supervisor = Number(this.formVendedor.id_supervisor);
          }

          this.usuariosService
            .crearVendedor(datosVendedor)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.guardando = false;
                this.limpiarFormVendedor();
                this.recargarGestionUsuarios();
                this.cdr.detectChanges();
                this.notificar('success', 'Vendedor creado exitosamente');
                this.volverALista();
              },
              error: (err) => {
                console.error('Error creando vendedor:', err);
                this.guardando = false;
                this.notificar(
                  'error',
                  `Error al crear vendedor: ${err?.error?.message || err?.message}`,
                );
                this.cdr.detectChanges();
              },
            });
        },
        error: (err) => {
          console.error('Error creando usuario:', err);
          this.guardando = false;
          this.notificar('error', `Error al crear usuario: ${err?.error?.message || err?.message}`);
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
      id_rol: 2,
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
          this.notificar('success', 'Supervisor creado exitosamente');
          this.volverALista();
        },
        error: (err) => {
          console.error('Error creando supervisor:', err);
          this.guardando = false;
          this.notificar(
            'error',
            `Error al crear supervisor: ${err?.error?.message || err?.message}`,
          );
          this.cdr.detectChanges();
        },
      });
  }

  // ============ CREAR ADMINISTRADOR ============
  crearAdministrador(): void {
    if (!this.validarFormAdministradorCreacion()) {
      return;
    }

    this.guardando = true;

    this.usuariosService
      .registrarAdministrador({
        username: this.formAdministrador.username.trim(),
        password: this.formAdministrador.password.trim(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardando = false;
          this.limpiarFormAdministrador();
          this.cargarAdministradores();
          this.cdr.detectChanges();
          this.notificar('success', 'Administrador creado exitosamente');
          this.volverALista();
        },
        error: (err) => {
          console.error('Error creando administrador:', err);
          this.guardando = false;
          this.notificar(
            'error',
            `Error al crear administrador: ${err?.error?.message || err?.message}`,
          );
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

    const idUsuario =
      this.usuarioEnEdicion?.id_usuario ??
      this.usuarioEnEdicion?.idUsuario ??
      this.vendedorEnEdicion?.id_usuario ??
      this.vendedorEnEdicion?.idUsuario ??
      this.usuarioEnEdicion?.id;
    const idVendedor = this.getIdVendedor(this.vendedorEnEdicion ?? this.usuarioEnEdicion);

    if (!idUsuario) {
      this.guardando = false;
      this.notificar('error', 'No se encontró el ID del usuario. No se puede actualizar.');
      this.cdr.detectChanges();
      return;
    }

    const datosUsuario: any = {
      username:
        this.formVendedor.username.trim() ||
        this.formVendedor.codigo.trim() ||
        this.getCodigoVendedor(this.vendedorEnEdicion ?? this.usuarioEnEdicion),
    };

    if (this.formVendedor.password.trim()) {
      datosUsuario.password = this.formVendedor.password.trim();
    }

    this.usuariosService
      .actualizarUsuario(idUsuario, datosUsuario)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (idVendedor) {
            const datosVendedor: any = {
              codigo_vendedor: this.formVendedor.codigo.trim(),
              nombre: this.formVendedor.nombre.trim(),
            };

            if (String(this.formVendedor.id_supervisor ?? '').trim()) {
              datosVendedor.id_supervisor = Number(this.formVendedor.id_supervisor);
            }

            this.usuariosService
              .actualizarVendedor(String(idVendedor), datosVendedor)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: () => {
                  this.guardando = false;

                  if (String(this.formVendedor.id_supervisor ?? '').trim()) {
                    this.actualizarAsignacionLocal(
                      this.vendedorEnEdicion,
                      Number(this.formVendedor.id_supervisor),
                    );
                  }

                  this.recargarGestionUsuarios();
                  this.cdr.detectChanges();
                  this.notificar('success', 'Vendedor actualizado exitosamente');
                  this.volverALista();
                },
                error: (err) => {
                  console.error('Error actualizando vendedor:', err);
                  this.guardando = false;
                  this.notificar(
                    'error',
                    err?.error?.message ?? err?.error?.mensaje ?? err?.message ?? 'Error al actualizar vendedor',
                  );
                  this.cdr.detectChanges();
                },
              });
          } else {
            this.guardando = false;
            this.recargarGestionUsuarios();
            this.cdr.detectChanges();
            this.notificar('success', 'Vendedor actualizado exitosamente');
            this.volverALista();
          }
        },
        error: (err) => {
          console.error('Error actualizando usuario:', err);
          this.guardando = false;
          this.notificar('error', 'Error al actualizar usuario');
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
          this.notificar('success', 'Supervisor actualizado exitosamente');
          this.volverALista();
        },
        error: (err) => {
          console.error('Error actualizando supervisor:', err);
          this.guardando = false;
          this.notificar('error', 'Error al actualizar supervisor');
          this.cdr.detectChanges();
        },
      });
  }

  // ============ ACTUALIZAR ADMINISTRADOR ============
  actualizarAdministrador(): void {
    if (!this.validarFormAdministrador()) {
      return;
    }

    this.guardando = true;

    const idUsuario = this.usuarioEnEdicion?.id_usuario ?? this.usuarioEnEdicion?.id;

    const datos: any = {
      username: this.formAdministrador.username.trim(),
    };

    if (this.formAdministrador.password.trim()) {
      datos.password = this.formAdministrador.password.trim();
    }

    this.usuariosService
      .actualizarUsuario(idUsuario, datos)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.guardando = false;
          this.cargarAdministradores();
          this.cdr.detectChanges();
          this.notificar('success', 'Administrador actualizado exitosamente');
          this.volverALista();
        },
        error: (err) => {
          console.error('Error actualizando administrador:', err);
          this.guardando = false;
          this.notificar('error', 'Error al actualizar administrador');
          this.cdr.detectChanges();
        },
      });
  }

  // ============ DESACTIVAR USUARIO ============
  toggleEstadoVendedor(vendedor: any): void {
    const estaInactivo = vendedor?.estado === false;
    const nuevoEstado = estaInactivo;
    const accion = estaInactivo ? 'activar' : 'desactivar';
    const etiqueta = estaInactivo ? 'activar' : 'desactivar';

    if (!confirm(`¿Seguro que deseas ${accion} al vendedor ${vendedor?.nombre}?`)) {
      return;
    }

    this.eliminando = true;

    const idUsuario = vendedor?.id_usuario ?? vendedor?.id;

    this.usuariosService
      .actualizarUsuario(idUsuario, { estado: nuevoEstado })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;

          const vendedorLocal = this.vendedores.find((v: any) => this.sonMismoVendedor(v, vendedor));
          if (vendedorLocal) {
            vendedorLocal.estado = nuevoEstado;
          }

          this.cdr.detectChanges();
          this.notificar('success', `Vendedor ${etiqueta === 'activar' ? 'activado' : 'desactivado'} correctamente`);
        },
        error: (err) => {
          console.error('Error actualizando estado del vendedor:', err);
          this.eliminando = false;
          this.notificar('error', `Error al ${accion} vendedor`);
          this.cdr.detectChanges();
        },
      });
  }

  toggleEstadoSupervisor(supervisor: any): void {
    const estaInactivo = supervisor?.estado === false;
    const nuevoEstado = !estaInactivo;
    const accion = estaInactivo ? 'activar' : 'desactivar';
    const etiqueta = estaInactivo ? 'activado' : 'desactivado';

    if (!confirm(`¿Seguro que deseas ${accion} al supervisor ${supervisor?.nombre}?`)) {
      return;
    }

    this.eliminando = true;

    const idUsuario = supervisor?.id_usuario ?? supervisor?.id;

    this.usuariosService
      .actualizarUsuario(idUsuario, { estado: nuevoEstado })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;

          const supervisorLocal = this.supervisores.find(
            (s: any) => String(this.getIdSupervisor(s)) === String(idUsuario),
          );

          if (supervisorLocal) {
            supervisorLocal.estado = nuevoEstado;
          }

          this.cdr.detectChanges();
          this.notificar('success', `Supervisor ${etiqueta} correctamente`);
        },
        error: (err) => {
          console.error('Error actualizando estado del supervisor:', err);
          this.eliminando = false;
          this.notificar('error', `Error al ${accion} supervisor`);
          this.cdr.detectChanges();
        },
      });
  }

  toggleEstadoAdministrador(administrador: any): void {
    const estaInactivo = administrador?.estado === false;
    const nuevoEstado = !estaInactivo;
    const accion = estaInactivo ? 'activar' : 'desactivar';
    const etiqueta = estaInactivo ? 'activado' : 'desactivado';

    if (!confirm(`¿Seguro que deseas ${accion} al administrador ${administrador?.nombre}?`)) {
      return;
    }

    this.eliminando = true;

    const idUsuario = administrador?.id_usuario ?? administrador?.id;

    this.usuariosService
      .actualizarUsuario(idUsuario, { estado: nuevoEstado })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.eliminando = false;

          const administradorLocal = this.administradores.find(
            (a: any) => String(a?.id_usuario ?? a?.id) === String(idUsuario),
          );

          if (administradorLocal) {
            administradorLocal.estado = nuevoEstado;
          }

          this.cdr.detectChanges();
          this.notificar('success', `Administrador ${etiqueta} correctamente`);
        },
        error: (err) => {
          console.error('Error actualizando estado del administrador:', err);
          this.eliminando = false;
          this.notificar('error', `Error al ${accion} administrador`);
          this.cdr.detectChanges();
        },
      });
  }

  // ============ VALIDACIONES ============
  private validarFormVendedor(): boolean {
    const { nombre, codigo, username, password } = this.formVendedor;

    if (!nombre.trim()) {
      this.notificar('error', 'Por favor completa el nombre');
      return false;
    }

    if (this.seccionActiva === 'crear-vendedor' && (!codigo.trim() || !username.trim())) {
      this.notificar('error', 'Por favor completa código y usuario');
      return false;
    }

    if (this.seccionActiva === 'crear-vendedor' && !password.trim()) {
      this.notificar('error', 'La contraseña es obligatoria para crear vendedor');
      return false;
    }

    return true;
  }

  private validarFormSupervisor(): boolean {
    const { nombre, username, password } = this.formSupervisor;

    if (!nombre.trim() || !username.trim()) {
      this.notificar('error', 'Por favor completa nombre y usuario');
      return false;
    }

    if (this.seccionActiva === 'crear-supervisor' && !password.trim()) {
      this.notificar('error', 'La contraseña es obligatoria para crear supervisor');
      return false;
    }

    return true;
  }

  private validarFormAdministrador(): boolean {
    const { nombre, username } = this.formAdministrador;

    if (!nombre.trim() || !username.trim()) {
      this.notificar('error', 'Por favor completa nombre y usuario');
      return false;
    }

    return true;
  }

  private validarFormAdministradorCreacion(): boolean {
    const { nombre, username, password } = this.formAdministrador;

    if (!nombre.trim() || !username.trim()) {
      this.notificar('error', 'Por favor completa nombre y usuario');
      return false;
    }

    if (!password.trim()) {
      this.notificar('error', 'La contraseña es obligatoria para crear administrador');
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
      id_supervisor: '',
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

  private limpiarFormAdministrador(): void {
    this.formAdministrador = {
      nombre: '',
      username: '',
      password: '',
    };
  }

  obtenerNombreSupervisor(idSupervisor: string | number): string {
    const supervisor = this.supervisores.find((s) => (s.id_usuario ?? s.id) == idSupervisor);
    return supervisor?.nombre ?? 'Sin asignar';
  }

  obtenerVendedoresDelSupervisor(idSupervisor: string | number): any[] {
    return this.vendedoresDelSupervisor.get(idSupervisor) ?? [];
  }
}
