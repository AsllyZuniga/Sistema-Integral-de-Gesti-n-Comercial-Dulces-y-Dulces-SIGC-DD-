import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';
import { CumplimientoSemanaService } from '../../core/services/ventas/cumplimientoVentasSemana.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { CardComponent } from '../../shared/components/card/card.component';
import {
  FiltersComponent,
  DashboardFilters,
} from '../../shared/components/filters/filters.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { VentasComponent } from '../dashboard/components/ventas/ventas.component';
import {
  CuotasCumplimientoComponent,
  TipoCuota,
} from '../cumplientosCuota/cumplimientos.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    FiltersComponent,
    SidebarComponent,
    VentasComponent,
    CuotasCumplimientoComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  // ─── Inyección con inject() — evita NG2003 en standalone ─────────────────────
  private authService = inject(AuthService);
  private router = inject(Router);
  private cumplimientoService = inject(CumplimientoService); // MES
  private semanaService = inject(CumplimientoSemanaService); // SEMANA
  private proveedorService = inject(ProveedorService);
  private usuariosService = inject(UsuariosService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;

  // ─── Estado ──────────────────────────────────────────────────────────────────
  vendedor: any = null;
  totales: any = null;
  isSidebarCollapsed = false;
  proveedoresList: string[] = [];
  ciudadesList: string[] = [];
  lineasList: string[] = [];
  tipoCuota: TipoCuota = 'mensual';
  rolId = 0;
  idSupervisor = 0; // ← ID del supervisor actual (para filtrar sus vendedores)
  cargandoVendedores = false;

  todosLosVendedores: any[] = [];
  vendedoresList: string[] = [];

  // ─── Modal de asignación de supervisores ──────────────────────────────────────
  supervisoresList: any[] = [];
  modalAsignarVisible = false;
  vendedorEnModal: any = null;
  supervisorSeleccionado: string = '';
  asignandoSupervisor = false;

  private proveedorMap: Map<string, string> = new Map();
  private ciudadMap: Map<string, string> = new Map();
  private lineaMap: Map<string, string> = new Map();
  private vendedorMap: Map<string, string> = new Map();

  private destroy$ = new Subject<void>();

  filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin: '',
    vendedor: '',
    proveedor: '',
    categoria: '',
    ciudad: '',
    linea: '',
  };

  constructor() {}

  // ─── Ciclo de vida ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.vendedor = this.authService.getVendedor();
    if (!this.vendedor) {
      this.vendedor = { codigo: '990', codVendedor: '990', nombre: 'Vendedor Prueba' };
    }
    this.rolId = Number(this.vendedor?.rol?.idRol ?? this.vendedor?.idRol ?? 0);
    
    // Guardar ID del supervisor si es supervisor
    if (this.esSupervisor) {
      this.idSupervisor = Number(this.vendedor?.id_usuario ?? this.vendedor?.idUsuario ?? this.vendedor?.id ?? 0);
      console.log('👤 Supervisor con ID:', this.idSupervisor, 'Nombre:', this.vendedor?.nombre);
    }

    const { inicio, fin } = this.getDefaultDateRange();
    this.filtrosActivos.fechaInicio = inicio;
    this.filtrosActivos.fechaFin = fin;

    this.cargarTotales();
    this.cargarOpcionesFiltros();
    
    // ─── Cargar supervisores para el modal (admin) ──────────────────────────────
    if (this.esAdmin) {
      this.cargarSupervisores();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Getters de rol y vendedor ───────────────────────────────────────────────
  get esAdmin(): boolean {
    return this.rolId === 1;
  }

  get esSupervisor(): boolean {
    return this.rolId === 2;
  }

  get codigoVendedor(): string {
    return this.vendedor?.codVendedor || this.vendedor?.codigo || this.vendedor?.codigo_vendedor || '';
  }

  // ─── Getters de etiquetas dinámicas según tipoCuota ─────────────────────────

  /** Etiqueta del botón/columna de cuota */
  get labelCuota(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'Cuota Semana';
      case 'diaria':
        return 'Cuota Diaria';
      default:
        return 'Cuota Mes';
    }
  }

  /** Campo del objeto vendedor que contiene la cuota según el periodo activo */
  get campoCuota(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'cuotaSemana';
      case 'diaria':
        return 'cuotaDiaria';
      default:
        return 'cuotaMes';
    }
  }

  /** Etiqueta de la venta acumulada según el periodo activo */
  get labelVentaAcum(): string {
    switch (this.tipoCuota) {
      case 'semanal':
        return 'Venta Semana';
      case 'diaria':
        return 'Venta Diaria';
      default:
        return 'Venta Mes';
    }
  }

  // ─── Helpers de fecha ────────────────────────────────────────────────────────
  private getDefaultDateRange(): { inicio: string; fin: string } {
    const hoy = new Date();
    return {
      inicio: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      fin: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── Acciones UI ─────────────────────────────────────────────────────────────
  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  /**
   * Se dispara cuando el usuario hace click en Cuota Diaria / Semanal / Mensual.
   * Actualiza tipoCuota y recarga los totales con el servicio correcto.
   */
  onCambiarTipoCuota(tipo: TipoCuota): void {
    if (this.tipoCuota === tipo) return; // evitar recargas innecesarias
    this.tipoCuota = tipo;
    this.totales = null; // limpiar cards mientras carga
    this.cdr.detectChanges();
    this.cargarTotales();
  }

  onToggleSidebar(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // ─── Carga de totales ────────────────────────────────────────────────────────
  /**
   * Decide qué servicio usar según tipoCuota:
   *   'semanal' → CumplimientoSemanaService  (/semana/...)
   *   'mensual' → CumplimientoService        (/mes/...)
   */
  cargarTotales(): void {
    const filtros = { ...this.filtrosActivos };

    if (this.tipoCuota === 'semanal') {
      // ── SEMANA ──────────────────────────────────────────────────────────────
      const obs$ = this.esAdmin || this.esSupervisor
        ? this.semanaService.getCumplimientoSemanaAdmin(filtros)
        : this.semanaService.getCumplimientoSemanaVendedor(filtros);

      (this.esAdmin || this.esSupervisor)
        ? this.cargarDesdeEndpointAdmin(obs$, 'cuotaSemana')
        : this.cargarDesdeEndpointVendedor(obs$, 'cuotaSemana');
    } else {
      // ── MES (default) ───────────────────────────────────────────────────────
      const obs$ = this.esAdmin || this.esSupervisor
        ? this.cumplimientoService.getCumplimientoMesAdmin(filtros)
        : this.cumplimientoService.getCumplimientoMesVendedor(filtros);

      (this.esAdmin || this.esSupervisor)
        ? this.cargarDesdeEndpointAdmin(obs$, 'cuotaMes')
        : this.cargarDesdeEndpointVendedor(obs$, 'cuotaMes');
    }
  }

  private cargarDesdeEndpointAdmin(obs$: any, campoCuota: string): void {
    this.cargandoVendedores = true;
    this.todosLosVendedores = [];

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        console.log('📊 RESPONSE COMPLETO del endpoint:', res);
        
        let detalle: any[] = (res?.detalle ?? []).filter((v: any) => v.codVendedor !== 'TOTALES');

        console.log('📋 Detalle después de filtrar TOTALES:', detalle);
        console.log('📋 Total vendedores en detalle:', detalle.length);
        
        // SUPERVISOR: Filtrar solo vendedores asignados a este supervisor
        if (this.esSupervisor) {
          console.log('🔍 SOY SUPERVISOR - ID de este supervisor:', this.idSupervisor);
          console.log('🔍 Mostrando TODOS los vendedores y sus id_supervisor:');
          
          detalle.forEach((v: any, idx: number) => {
            const idSupervisorDelVendedor = v?.id_supervisor ?? v?.idSupervisor ?? 0;
            console.log(`   [${idx}] ${v?.nombre} | id_supervisor en objeto: ${idSupervisorDelVendedor} | ¿Match? ${Number(idSupervisorDelVendedor) === this.idSupervisor}`);
          });
          
          detalle = detalle.filter((v: any) => {
            const idSupervisorDelVendedor = v?.id_supervisor ?? v?.idSupervisor ?? 0;
            const match = Number(idSupervisorDelVendedor) === this.idSupervisor;
            return match;
          });
          
          console.log('🔍 Vendedores después de filtrar por supervisor:', detalle.length);
        }

        const lista = this.filtrosActivos.vendedor
          ? detalle.filter((v: any) => v.codVendedor === this.filtrosActivos.vendedor)
          : detalle;

        this.todosLosVendedores = lista;
        console.log('📌 todosLosVendedores asignado:', this.todosLosVendedores.length, 'vendedores');

        // Reconstruir lista de vendedores para el filtro
        this.vendedorMap.clear();
        const nombresUnicos = new Set<string>();
        detalle.forEach((v: any) => {
          if (v.nombre && v.codVendedor) {
            this.vendedorMap.set(v.nombre, v.codVendedor);
            nombresUnicos.add(v.nombre);
          }
        });
        this.vendedoresList = Array.from(nombresUnicos).sort();

        // Calcular totales para las cards KPI
        const ventaAcum = lista.reduce((s: number, v: any) => s + (Number(v.ventaAcum) || 0), 0);
        const cuota = lista.reduce((s: number, v: any) => s + (Number(v[campoCuota]) || 0), 0);
        const proyeccionVenta = lista.reduce(
          (s: number, v: any) => s + (Number(v.proyeccionVenta) || 0),
          0,
        );
        const porcCump = cuota > 0 ? (ventaAcum / cuota) * 100 : 0;

        // cuotaMes se usa como campo genérico en totales para el card
        this.totales = { ventaAcum, cuotaMes: cuota, porcCump, proyeccionVenta };
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.totales = null;
        this.cargandoVendedores = false;
        this.cdr.detectChanges();
      },
    });
  }

  private cargarDesdeEndpointVendedor(obs$: any, campoCuota: string): void {
    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        const detalle: any[] = (res?.detalle ?? []).filter((v: any) => v.codVendedor !== 'TOTALES');
        const d = detalle[0];
        if (!d) {
          this.totales = null;
          this.cdr.detectChanges();
          return;
        }

        this.totales = {
          ventaAcum: d.ventaAcum,
          cuotaMes: d[campoCuota], // campo genérico para el card
          porcCump: d.porcCump,
          proyeccionVenta: d.proyeccionVenta,
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.totales = null;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Opciones para filtros desplegables ──────────────────────────────────────
  cargarOpcionesFiltros(): void {
    this.cumplimientoService
      .getProveedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((proveedores) => {
        this.proveedorMap.clear();
        const unicos = new Set<string>();
        proveedores.forEach((item: any) => {
          if (item.nombre && item.codigo) {
            this.proveedorMap.set(item.nombre, item.codigo);
            unicos.add(item.nombre);
          }
        });
        this.proveedoresList = Array.from(unicos).sort();
      });

    if (!this.esAdmin && this.codigoVendedor) {
      this.cumplimientoService
        .getLineasPorVendedor(this.codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado = res?.detallePorLinea ?? [];
          this.lineaMap.clear();
          const unicos = new Set<string>();
          listado.forEach((item: any) => {
            if (item.codigoLinea && item.linea) {
              this.lineaMap.set(item.linea, item.codigoLinea);
              unicos.add(item.linea);
            }
          });
          this.lineasList = Array.from(unicos).sort();
        });

      this.cumplimientoService
        .getCiudadesPorVendedor(this.codigoVendedor)
        .pipe(takeUntil(this.destroy$))
        .subscribe((res) => {
          const listado = res?.detallePorCiudad ?? [];
          this.ciudadMap.clear();
          const unicos = new Set<string>();
          listado.forEach((item: any) => {
            const cod = item.codCiudad || item.codigo || item.cod;
            if (item.ciudad && cod) {
              this.ciudadMap.set(item.ciudad, cod);
              unicos.add(item.ciudad);
            }
          });
          this.ciudadesList = Array.from(unicos).sort();
        });
    }
  }

  // ─── Aplicar filtros desde FiltersComponent ──────────────────────────────────
  onAplicarFiltros(filtros: DashboardFilters): void {
    const filtrosConCodigos: DashboardFilters = {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin,
      vendedor: '',
      proveedor: '',
      categoria: filtros.categoria || '',
      ciudad: '',
      linea: filtros.linea || '',
    };

    if (filtros.vendedor)
      filtrosConCodigos.vendedor = this.vendedorMap.get(filtros.vendedor) ?? filtros.vendedor;
    if (filtros.proveedor)
      filtrosConCodigos.proveedor = this.proveedorMap.get(filtros.proveedor) ?? filtros.proveedor;
    if (filtros.ciudad)
      filtrosConCodigos.ciudad = this.ciudadMap.get(filtros.ciudad) ?? filtros.ciudad;
    if (filtros.linea) filtrosConCodigos.linea = this.lineaMap.get(filtros.linea) ?? filtros.linea;

    this.filtrosActivos = filtrosConCodigos;
    this.cargarTotales();
  }

  // ─── Supervisores ───────────────────────────────────────────────────────────

  /**
   * Carga la lista de supervisores disponibles
   */
  private cargarSupervisores(): void {
    console.log('📥 Cargando supervisores...');
    this.usuariosService.listarSupervisores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          console.log('✅ Supervisores cargados:', res);
          this.supervisoresList = Array.isArray(res) ? res : [];
          console.log('📋 supervisoresList actualizada:', this.supervisoresList);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('❌ Error cargando supervisores:', err);
          this.supervisoresList = [];
        }
      });
  }

  /**
   * Abre la modal para asignar supervisor a un vendedor
   */
  abrirModalAsignar(vendedor: any): void {
    this.vendedorEnModal = vendedor;
      this.supervisorSeleccionado = vendedor?.id_supervisor ?? vendedor?.idSupervisor ?? '';
    this.modalAsignarVisible = true;
    this.cdr.detectChanges();
  }

  /**
   * Cierra la modal de asignación
   */
  cerrarModalAsignar(): void {
    this.modalAsignarVisible = false;
    this.vendedorEnModal = null;
    this.supervisorSeleccionado = '';
    this.asignandoSupervisor = false;
    this.cdr.detectChanges();
  }

  /**
   * Asigna el supervisor seleccionado al vendedor
   */
  asignarSupervisor(): void {
    if (!this.vendedorEnModal || !this.supervisorSeleccionado) {
      console.warn('⚠️ Modal vacio o supervisor no seleccionado');
      return;
    }

    this.asignandoSupervisor = true;
    this.cdr.detectChanges();

    // Usar codVendedor del objeto vendedor
    const codVendedor = this.vendedorEnModal.codVendedor;
    const idSupervisor = this.supervisorSeleccionado;
    
    if (!codVendedor) {
      alert('Error: No se pudo identificar el vendedor');
      this.asignandoSupervisor = false;
      return;
    }

    console.log('📤 ENVIANDO: PUT /vendedor/' + codVendedor + '/asignar-supervisor');
    console.log('   Payload:', { idSupervisor });

    this.usuariosService.asignarSupervisor(codVendedor.toString(), idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          console.log('✅ RESPUESTA ÉXITO:', res);
          console.log('✅ Supervisor asignado correctamente a vendedor', codVendedor);

          const supervisorPersistido = Number(res?.id_supervisor ?? res?.idSupervisor ?? 0);
          if (!supervisorPersistido) {
            console.warn('⚠️ Backend respondió éxito pero no persistió id_supervisor:', res);
            this.asignandoSupervisor = false;
            alert('⚠️ El backend respondió éxito, pero no guardó el supervisor (id_supervisor sigue null). Revisa el endpoint de asignación.');
            this.cdr.detectChanges();
            return;
          }
          
          // Actualizar vendedor en la tabla
          const idx = this.todosLosVendedores.findIndex(
            v => v.codVendedor === this.vendedorEnModal.codVendedor
          );
          console.log('   Índice en tabla:', idx, 'Total vendedores en tabla:', this.todosLosVendedores.length);
          
          if (idx >= 0) {
            const supervisorAsignado = this.supervisoresList.find(
              (s: any) => (s.id_usuario ?? s.idUsuario ?? s.id) === idSupervisor
            );
            this.todosLosVendedores[idx].id_supervisor = idSupervisor;
            this.todosLosVendedores[idx].nombreSupervisor = supervisorAsignado?.username ?? supervisorAsignado?.nombre ?? '';
            console.log('   ✅ Tabla actualizada');
          } else {
            console.warn('   ⚠️ No se encontró vendedor en tabla local para actualizar');
          }
          
          this.asignandoSupervisor = false;
          this.cerrarModalAsignar();
          alert('✅ Supervisor asignado correctamente');
          this.cdr.detectChanges();
          
          // IMPORTANTE: Si eres supervisor, recarga los datos para ver el vendedor asignado
          if (this.esSupervisor) {
            console.log('🔄 Supervisor: Recargando datos para ver vendedores asignados...');
            setTimeout(() => {
              this.cargarTotales();
            }, 500);
          }
        },
        error: (err: any) => {
          console.error('❌ ERROR EN PUT:', err);
          console.error('   Status:', err?.status);
          console.error('   Message:', err?.message);
          console.error('   Error completo:', err);
          this.asignandoSupervisor = false;
          alert('❌ Error al asignar supervisor: ' + (err?.error?.message || err?.message || 'Error desconocido'));
          this.cdr.detectChanges();
        }
      });
  }

  // ─── Carga de Vendedores (Admin y Supervisor) ────────────────────────────────

  /**
   * Admin: Carga TODOS los vendedores para la tabla
   */
  private cargarVendedoresAdmin(): void {
    this.cargandoVendedores = true;
    this.todosLosVendedores = [];

    this.usuariosService.listarVendedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const vendedores = Array.isArray(res) ? res : res?.data ?? [];
          this.todosLosVendedores = vendedores;
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
        error: () => {
          console.error('❌ Error cargando vendedores');
          this.todosLosVendedores = [];
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Supervisor: Carga solo sus vendedores asignados
   */
  private cargarVendedoresSupervisor(): void {
    const idSupervisor = this.vendedor?.id_usuario ?? this.vendedor?.idUsuario ?? this.vendedor?.id ?? '';
    
    if (!idSupervisor) {
      console.warn('⚠️ No se pudo obtener ID del supervisor');
      this.todosLosVendedores = [];
      return;
    }

    this.cargandoVendedores = true;
    this.todosLosVendedores = [];

    this.usuariosService.obtenerVendedoresDelSupervisor(idSupervisor)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const vendedores = Array.isArray(res) ? res : res?.data ?? [];
          this.todosLosVendedores = vendedores;
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        },
        error: () => {
          console.error('❌ Error cargando vendedores del supervisor');
          this.todosLosVendedores = [];
          this.cargandoVendedores = false;
          this.cdr.detectChanges();
        }
      });
  }
}
