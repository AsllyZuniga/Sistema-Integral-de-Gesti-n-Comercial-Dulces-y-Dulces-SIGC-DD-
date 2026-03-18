import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { CumplimientoService } from '../../core/services/ventas/cumplimientoVentasMes.service';
import { ProveedorService } from '../../core/services/proveedor.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { FiltersComponent, DashboardFilters } from '../../shared/components/filters/filters.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { VentasComponent } from '../dashboard/components/ventas/ventas.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, CardComponent, FiltersComponent, SidebarComponent, VentasComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(SidebarComponent) sidebarRef!: SidebarComponent;

  vendedor:          any     = null;
  totales:           any     = null;
  isSidebarCollapsed         = false;
  proveedoresList:   string[] = [];
  ciudadesList:      string[] = [];
  lineasList:        string[] = [];

  // Mapa para convertir entre nombres y códigos
  private proveedorMap: Map<string, string> = new Map(); // nombre -> código
  private ciudadMap:    Map<string, string> = new Map(); // nombre -> código
  private lineaMap:     Map<string, string> = new Map(); // nombre -> código


  filtrosActivos: DashboardFilters = {
    fechaInicio: '',
    fechaFin:    '',
    vendedor:    '',
    proveedor:   '',
    categoria:   '',
    ciudad:      '',
    linea:       '',
  };

  constructor(
    private authService:        AuthService,
    private router:             Router,
    private cumplimientoService: CumplimientoService,
    private proveedorService:   ProveedorService,
    private cdr:                ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    console.log('📍 [DASHBOARD] ngOnInit iniciado');
    
    // Verificar directamente en sessionStorage
    const vendedorRaw = sessionStorage.getItem('vendedor');
    console.log('🔍 [DASHBOARD] vendedor RAW en sessionStorage:', vendedorRaw);
    
    this.vendedor = this.authService.getVendedor();
    console.log('👤 [DASHBOARD] Vendedor obtenido del AuthService:', this.vendedor);

    if (!this.vendedor || this.vendedor === null) {
      console.warn('⚠️ [DASHBOARD] Vendedor es null, usando valores por defecto');
      this.vendedor = {
        codigo:      '990',
        codVendedor: '990',
        nombre:      'Vendedor Prueba',
      };
    }

    console.log('✅ [DASHBOARD] codigoVendedor final:', this.codigoVendedor);

    // Establecer fechas por defecto del mes actual
    const { inicio, fin } = this.getDefaultDateRange();
    this.filtrosActivos.fechaInicio = inicio;
    this.filtrosActivos.fechaFin = fin;

    console.log('📅 [DASHBOARD] Filtros iniciales:', this.filtrosActivos);

    // ✅ Los códigos se extraerán desde getProductosPorVendedor
    // No es necesario cargarlos desde un endpoint separado
    
    this.cargarTotales();
    this.cargarOpcionesFiltros();
  }

  private getDefaultDateRange(): { inicio: string; fin: string } {
    const hoy = new Date();
    const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    const inicio = this.formatDate(primerDiaDelMes);
    const fin = this.formatDate(ultimoDiaDelMes);

    return { inicio, fin };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get codigoVendedor(): string {
    return this.vendedor?.codVendedor || this.vendedor?.codigo || '';
  }

  toggleMenuMovil(): void {
    this.sidebarRef?.toggleMobile();
  }

  cargarTotales(): void {
    if (!this.codigoVendedor) return;

    const tieneProveedorLinea = !!this.filtrosActivos.proveedor;
    const codigoProveedor = this.filtrosActivos.proveedor;
    const filtros = { ...this.filtrosActivos };

    console.group('📤 [DASHBOARD.cargarTotales] Enviando request al backend');
    console.log('');
    console.log('📋 PARÁMETROS A ENVIAR:');
    console.log(`  Vendedor código: "${this.codigoVendedor}"`);
    console.log(`  Proveedor (código): "${codigoProveedor || '(vacío)'}"`);
    console.log(`  Línea (código): "${this.filtrosActivos.linea || '(vacío)'}"`);
    console.log(`  Fecha inicio: "${this.filtrosActivos.fechaInicio}"`);
    console.log(`  Fecha fin: "${this.filtrosActivos.fechaFin}"`);
    console.groupEnd();

    if (tieneProveedorLinea) {
      // Usar endpoint específico de vendedor y proveedor/linea
      this.cumplimientoService
        .getDetallePorLineaProveedor(this.codigoVendedor, codigoProveedor, filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            console.group('✅ [DASHBOARD.cargarTotales] Response recibida del backend (detalle por linea/proveedor)');
            console.log('Estructura:', res);
            if (!res || !res.detallePorLinea || res.detallePorLinea.length === 0) {
              this.totales = null;
              console.warn('⚠️ Sin datos para el filtro seleccionado');
              console.groupEnd();
              this.cdr.detectChanges();
              return;
            }
            // Usar el primer elemento del array
            const detalle = res.detallePorLinea[0];
            this.totales = {
              ventaAcum:        detalle.ventaAcum,
              cuotaMes:         detalle.cuotaMes,
              porcCump:         detalle.porcCump,
              proyeccionVenta:  detalle.proyeccionVenta,
            };
            console.log('📊 Totales extraídos y guardados:', this.totales);
            console.groupEnd();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.group('❌ [DASHBOARD.cargarTotales] ERROR en la request (detalle por linea/proveedor)');
            console.error('Error:', err);
            this.totales = null;
            this.cdr.detectChanges();
            console.groupEnd();
          }
        });
    } else {
      // Usar endpoint general
      this.cumplimientoService
        .getCumplimientoPorCodigo(this.codigoVendedor, filtros)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            console.group('✅ [DASHBOARD.cargarTotales] Response recibida del backend (general)');
            console.log('Estructura:', res);
            if (!res || !res.totales) {
              this.totales = null;
              console.warn('⚠️ Response vacía o sin propiedad "totales"');
              console.groupEnd();
              this.cdr.detectChanges();
              return;
            }
            this.totales = {
              ventaAcum:        res.totales.ventaAcum,
              cuotaMes:         res.totales.cuotaMes,
              porcCump:         res.totales.porcCump,
              proyeccionVenta:  res.totales.proyeccionVenta,
            };
            console.log('📊 Totales extraídos y guardados:', this.totales);
            console.groupEnd();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.group('❌ [DASHBOARD.cargarTotales] ERROR en la request (general)');
            console.error('Error:', err);
            this.totales = null;
            this.cdr.detectChanges();
            console.groupEnd();
          }
        });
    }
  }

  cargarOpcionesFiltros(): void {
    if (!this.codigoVendedor) return;

    console.group('📋 [DASHBOARD.cargarOpcionesFiltros] Cargando opciones de filtros');
    console.log('');
    
    // 1️⃣ PROVEEDORES - Del endpoint /proveedor del backend
    console.log('🔄 1. Cargando PROVEEDORES del backend...');
    this.cumplimientoService
      .getProveedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((proveedores) => {
        console.log(`  ✅ Proveedores recibidos: ${proveedores.length}`);
        
        // Limpiar mapa
        this.proveedorMap.clear();
        
        // Mapear: nombre -> código
        const proveedoresUnicos = new Set<string>();
        proveedores.forEach((item: any) => {
          const nombre = item.nombre;      // "ENERGIZER", "HENKEL", etc.
          const codigo = item.codigo;       // "880", "640", etc.
          
          if (nombre && codigo) {
            // Guardar en el mapa para búsqueda rápida
            this.proveedorMap.set(nombre, codigo);
            proveedoresUnicos.add(nombre);
            console.log(`    ✅ Mapeado: "${nombre}" (${codigo})`);
          } else {
            console.warn(`    ⚠️ Proveedor incompleto:`, item);
          }
        });
        
        this.proveedoresList = Array.from(proveedoresUnicos).sort();
        console.log(`  📊 Total proveedores únicos: ${this.proveedoresList.length}`);
        console.log(`  🗺️ Mapa final de proveedores:`, Object.fromEntries(this.proveedorMap));
      });

    // 2️⃣ LÍNEAS
    console.log('');
    console.log('🔄 2. Cargando LÍNEAS del backend...');
    this.cumplimientoService
      .getLineasPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const listado = res?.detallePorLinea ?? [];
        
        console.log(`  ✅ Líneas recibidas: ${listado.length}`);
        
        // Limpiar mapa
        this.lineaMap.clear();
        
        // Mapear: nombreLinea -> codigoLinea
        const lineasUnicas = new Set<string>();
        listado.forEach((item: any) => {
          const codigoLinea = item.codigoLinea;  // "090"
          const nombreLinea = item.linea;         // "090 - ADRO"
          
          if (codigoLinea && nombreLinea) {
            this.lineaMap.set(nombreLinea, codigoLinea);
            lineasUnicas.add(nombreLinea);
            console.log(`    ✅ Mapeada: "${nombreLinea}" (${codigoLinea})`);
          }
        });
        
        this.lineasList = Array.from(lineasUnicas).sort();
        console.log(`  📊 Total líneas: ${this.lineasList.length}`);
        console.log(`  🗺️ Mapa final de líneas:`, Object.fromEntries(this.lineaMap));
      });

    // 3️⃣ CIUDADES
    console.log('');
    console.log('🔄 3. Cargando CIUDADES del backend...');
    this.cumplimientoService
      .getCiudadesPorVendedor(this.codigoVendedor)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const listado = res?.detallePorCiudad ?? [];
        
        console.log(`  ✅ Ciudades recibidas: ${listado.length}`);
        
        // Limpiar mapa
        this.ciudadMap.clear();
        
        // Mapear: nombreCiudad -> codigoCiudad
        const ciudadesUnicas = new Set<string>();
        listado.forEach((item: any) => {
          const nombreCiudad = item.ciudad;       // "Bogotá", "Medellín", etc.
          const codigoCiudad = item.codCiudad || item.codigo || item.cod;  // "001", "002", etc.
          
          if (nombreCiudad && codigoCiudad) {
            this.ciudadMap.set(nombreCiudad, codigoCiudad);
            ciudadesUnicas.add(nombreCiudad);
            console.log(`    ✅ Mapeada: "${nombreCiudad}" (${codigoCiudad})`);
          }
        });
        
        this.ciudadesList = Array.from(ciudadesUnicas).sort();
        
      });
  }

  onAplicarFiltros(filtros: DashboardFilters): void {
    console.group('🎯 [DASHBOARD.onAplicarFiltros] Aplicando filtros');
    
    console.log('📥 Filtros recibidos:', filtros);
    console.log('');
    
    // Verificar mapas disponibles
    console.log('🗺️ MAPAS DISPONIBLES:');
    console.log(`  ✓ Proveedores en mapa: ${this.proveedorMap.size} elementos`);
    if (this.proveedorMap.size > 0) {
      console.log('    Contenido:', Object.fromEntries(this.proveedorMap));
    } else {
      console.warn('    ⚠️ MAPA VACÍO - Los códigos de proveedor no están disponibles!');
    }
    
    console.log(`  ✓ Ciudades en mapa: ${this.ciudadMap.size} elementos`);
    if (this.ciudadMap.size > 0) {
      console.log('    Contenido:', Object.fromEntries(this.ciudadMap));
    }
    
    console.log(`  ✓ Líneas en mapa: ${this.lineaMap.size} elementos`);
    if (this.lineaMap.size > 0) {
      console.log('    Contenido:', Object.fromEntries(this.lineaMap));
    }
    console.log('');
    
    const filtrosConCodigos: DashboardFilters = {
      fechaInicio: filtros.fechaInicio,
      fechaFin: filtros.fechaFin,
      vendedor: filtros.vendedor || '',
      proveedor: '',
      categoria: filtros.categoria || '',
      ciudad: '',
      linea: filtros.linea || ''
    };
    
    // Convertir PROVEEDOR
    if (filtros.proveedor) {
      const codigoProveedor = this.proveedorMap.get(filtros.proveedor);
      
      
      
      if (codigoProveedor) {
        filtrosConCodigos.proveedor = codigoProveedor;
        console.log(`  Output (código): "${codigoProveedor}"`);
      } else {
        filtrosConCodigos.proveedor = filtros.proveedor;
        console.warn(`  ⚠️ FALLBACK: Enviando el valor original "${filtros.proveedor}"`);
      }
    }
    
    // Convertir CIUDAD
    if (filtros.ciudad) {
      const codigoCiudad = this.ciudadMap.get(filtros.ciudad);
      
      
      
      if (codigoCiudad) {
        filtrosConCodigos.ciudad = codigoCiudad;
        console.log(`  Output (código): "${codigoCiudad}"`);
      } else {
        filtrosConCodigos.ciudad = filtros.ciudad;
        console.warn(`  ⚠️ FALLBACK: Enviando el valor original "${filtros.ciudad}"`);
      }
    }
    
    // Convertir LÍNEA
    if (filtros.linea) {
      const codigoLinea = this.lineaMap.get(filtros.linea);
      
      
      
      if (codigoLinea) {
        filtrosConCodigos.linea = codigoLinea;
        console.log(`  Output (código): "${codigoLinea}"`);
      } else {
        filtrosConCodigos.linea = filtros.linea;
        console.warn(`  ⚠️ FALLBACK: Enviando el valor original "${filtros.linea}"`);
      }
    }
    
    console.log('');
    console.log('✅ FILTROS FINALES A ENVIAR AL BACKEND:');
    console.log(filtrosConCodigos);
    console.groupEnd();

    this.filtrosActivos = filtrosConCodigos;
    this.cargarTotales();
  }

  onToggleSidebar(collapsed: boolean): void {
    this.isSidebarCollapsed = collapsed;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}