import { Directive } from '@angular/core';
import { forkJoin, merge, of, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RoleId } from '../../../../../../core/auth/roles';
import { DashboardFilters } from '../../../../../../shared/components/filters/filters.component';
import { VentasSupervisorBase } from '../supervisor/ventas-supervisor-base';
import { CuotaDiaVendedor } from '../../../../../../core/services/ventas/cuotaDia.service';

@Directive()
export abstract class VentasVendedorBase extends VentasSupervisorBase {

  cargarVistaActual(force = false): void {
    if (!this._codigoVendedor && !this.esModoAdminTodos()) return;

    const cargaKey = this.construirCargaKey();
    if (!force && cargaKey === this.ultimaCargaKey) {
      this.debugLog('VentasComponent.cargarVistaActual', 'Carga omitida por parametros repetidos');
      return;
    }
    this.ultimaCargaKey = cargaKey;
    this.debugLog('VentasComponent.cargarVistaActual', `Cargando vista ${this.activeVentasView}`);

    // Cancela peticiones previas para que solo pinte la carga mas reciente.
    this.recargarVista$.next();

    this.resetearVista();

    const filtrosBase = this.aplicarFechasPorDefecto(this._filtros);
    const filtrosConsulta = this.vistaUsaUltimoMesPorDefecto(this.activeVentasView)
      ? this.aplicarUltimoMesCargadoPorDefecto(filtrosBase)
      : filtrosBase;

    if (this.esModoAdminTodos()) {
      this.cargarVistaAdminTodos(filtrosConsulta);
      return;
    }

    const tieneProveedor = !!filtrosConsulta.proveedor;
    const codigoProveedor = filtrosConsulta.proveedor;
    const tieneCiudad = !!(filtrosConsulta.ciudad || filtrosConsulta.ciudadNombre);
    const codigoCiudad = String(filtrosConsulta.ciudad ?? '').trim();

    switch (this.activeVentasView) {
      case 'vendedor': {
        this.chartType = 'bar';

        if (this._tipoCuota === 'diaria') {
          console.debug('[VentasVendedorBase] Cuota diaria - rolId detectado:', this.rolId, {
            esAdmin: this.rolId === RoleId.ADMINISTRADOR,
            esSupervisor: this.rolId === RoleId.SUPERVISOR,
          });
          if (this.rolId === RoleId.ADMINISTRADOR) {
            this.cargarVendedorCuotaDiariaAdmin(filtrosConsulta);
          } else if (this.rolId === RoleId.SUPERVISOR) {
            this.cargarVendedorCuotaDiariaSupervisor(filtrosConsulta);
          } else {
            this.cargarVendedorCuotaDiaria(filtrosConsulta);
          }
          break;
        }

        const cargarDesdeAdmin =
          this.rolId === RoleId.ADMINISTRADOR || this.rolId === RoleId.SUPERVISOR || this.tieneCodigosVendedoresPermitidos();

        if (cargarDesdeAdmin) {
          const admin$ = this.esSemanal
            ? this.semanaService.getCumplimientoSemanaAdmin(filtrosConsulta)
            : this.cumplimientoService.getCumplimientoMesAdmin(filtrosConsulta);

          admin$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const detalle = this.filtrarPorCodigosVendedoresPermitidos(
                this.mapearDetalleAdminAVendedores(res?.detalle ?? []),
              );

              this.pintarVistaVendedor(detalle, filtrosConsulta, 'chart-vendedor');
            });
          break;
        }

        const vendedor$ = this.esSemanal
          ? this.semanaService.getCumplimientoSemanaVendedor(filtrosConsulta)
          : this.cumplimientoService.getCumplimientoPorCodigo(
              this._codigoVendedor,
              filtrosConsulta,
            );

        vendedor$
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const detalle = this.mapearDetalleAdminAVendedores(res?.detalle ?? []);
            this.pintarVistaVendedor(detalle, filtrosConsulta, 'chart-vendedor');
          });
        break;
      }

      case 'ventas':
        this.chartType = 'line';

        if (this._tipoCuota === 'diaria') {
          this.cargarVentasCuotaDiaria(filtrosConsulta);
          break;
        }

        if (tieneProveedor) {
          const detalleProveedor$ = this.esSemanal
            ? this.semanaService.getDetallePorLineaProveedor(
                this._codigoVendedor,
                codigoProveedor,
                filtrosConsulta,
              )
            : this.cumplimientoService.getDetallePorLineaProveedor(
                this._codigoVendedor,
                codigoProveedor,
                filtrosConsulta,
              );

          detalleProveedor$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const detalle = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              const listadoTabla = this.ordenarProveedoresPorAlfabeto(detalle);
              const topProveedores = this.limitarTopProveedores(detalle);
              this.tableData = listadoTabla;
              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea,
                value: i.ventaAcum,
              }));
              this.cdr.markForCheck();
            });
        } else if (tieneCiudad) {
          const ciudades$ = this.esSemanal
            ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, filtrosConsulta)
            : codigoCiudad
              ? this.cumplimientoService.getDetallePorCiudad(
                  this._codigoVendedor,
                  codigoCiudad,
                  filtrosConsulta,
                )
              : this.cumplimientoService.getCiudadesPorVendedor(
                  this._codigoVendedor,
                  filtrosConsulta,
                );

          ciudades$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const listadoFiltrado = this.filtrarPorCiudadSeleccionada(res?.detallePorCiudad ?? []);
              const consolidado = this.consolidarPorCiudad(listadoFiltrado);
              this.tableData = consolidado;
              this.chartData = consolidado.map((i: any) => ({
                name: this.repararTextoCiudad(i.ciudad),
                value: i.ventaAcum,
              }));
              this.cdr.markForCheck();
            });
        } else if (this.esSemanal) {
          this.semanaService
            .getCumplimientoSemanaVendedor(filtrosConsulta)
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const d = (res?.detalle ?? []).find((v: any) => v.codVendedor !== 'TOTALES');
              if (!d) return;

              this.tableData = [d];
              this.chartData = [
                { name: 'Venta', value: d.ventaAcum },
                { name: 'Cuota', value: d.cuotaSemana },
                { name: 'Proyección', value: d.proyeccionVenta },
              ];
              this.cdr.markForCheck();
            });
        } else {
          this.cumplimientoService
            .getCumplimientoPorCodigo(this._codigoVendedor, filtrosConsulta)
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              if (!res?.totales) return;

              this.tableData = res.detalle ?? [];
              this.chartData = [
                { name: 'Venta', value: res.totales.ventaAcum },
                { name: 'Cuota', value: res.totales.cuotaMes },
                { name: 'Proyección', value: res.totales.proyeccionVenta },
              ];
              this.cdr.markForCheck();
            });
        }
        break;

      case 'proveedor':
        this.chartType = 'bar';

        {
          const categoriasSeleccionadasOriginales = Array.isArray(filtrosConsulta.categorias)
            ? filtrosConsulta.categorias.filter(Boolean)
            : [];

          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarProveedor = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const filtrosSinProveedor = this.quitarProveedorDeFiltros(filtrosActivos);
            const lineas$ = this.esSemanal
              ? this.semanaService.getLineasPorVendedor(this._codigoVendedor, filtrosSinProveedor)
              : this.cumplimientoService.getLineasPorVendedor(
                  this._codigoVendedor,
                  filtrosSinProveedor,
                );

            lineas$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listado = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
                const listadoFiltrado = this.filtrarProveedores(listado, codigoProveedor);

                if (!listadoFiltrado.length && idx < candidatos.length - 1) {
                  intentarProveedor(idx + 1);
                  return;
                }

                const listadoTabla = this.ordenarProveedoresPorAlfabeto(listado);
                const topProveedores = [...listadoFiltrado]
                  .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                  .slice(0, 12);

                this.totalTopProveedores = topProveedores.reduce(
                  (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.liderVentasProveedor = this.nombreProveedorCard(
                  topProveedores[0]?.linea ?? '—',
                );

                this.tableData = codigoProveedor
                  ? this.ordenarProveedoresPorAlfabeto(listadoFiltrado)
                  : listadoTabla;
                this.totalCuotaProveedor = this.tableData.reduce(
                  (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                  0,
                );
                this.totalAcumuladoProveedor = this.tableData.reduce(
                  (sum: number, item: any) =>
                    sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.totalCuotaProveedor = this.tableData.reduce(
                  (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                  0,
                );
                this.totalAcumuladoProveedor = this.tableData.reduce(
                  (sum: number, item: any) =>
                    sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.chartData = topProveedores.map((i: any) => ({
                  name: i.linea,
                  value: Number(i.ventaAcum ?? 0),
                }));
                this.cdr.markForCheck();
              });
          };

          intentarProveedor(0);
        }
        break;

      case 'categoria':
        this.chartType = 'bar';

        {
          const categoriasSeleccionadasOriginales = Array.isArray(filtrosConsulta.categorias)
            ? filtrosConsulta.categorias.filter(Boolean)
            : [];

          console.debug('[Ventas-VendedorBase] Vista categoría - categorías seleccionadas:', categoriasSeleccionadasOriginales);
          console.debug('[Ventas-VendedorBase] Vista categoría - filtros completos:', filtrosConsulta);

          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCategoria = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            
            console.debug('[Ventas-VendedorBase] Intentando cargar categorías con filtros:', filtrosActivos);
            
            // Si hay múltiples categorías seleccionadas, hacer múltiples llamadas
            if (categoriasSeleccionadasOriginales.length > 1) {
              console.debug('[Ventas-VendedorBase] Múltiples categorías seleccionadas:', categoriasSeleccionadasOriginales.length);
              
              const peticiones = categoriasSeleccionadasOriginales.map((categoria) => {
                const filtrosConUnaCategoria = {
                  ...filtrosActivos,
                  categorias: [categoria],
                  categoria: categoria,
                };
                
                return this.esSemanal
                  ? this.semanaService.getCuotaCategoriaPorVendedor(
                      this._codigoVendedor,
                      filtrosConUnaCategoria,
                    )
                  : this.cumplimientoService.getCuotaCategoriaPorVendedor(
                      this._codigoVendedor,
                      filtrosConUnaCategoria,
                    );
              });

              forkJoin(peticiones)
                .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
                .subscribe((respuestas: any[]) => {
                  console.debug('[Ventas-VendedorBase] Respuestas de múltiples categorías:', respuestas);
                  
                  // Combinar todos los detalles de las respuestas
                  const detalleCombinado = respuestas.flatMap((res: any) => 
                    Array.isArray(res?.detalle) ? res.detalle : []
                  );
                  
                  console.debug('[Ventas-VendedorBase] Detalle combinado:', detalleCombinado.length, 'registros');
                  
                  const detalleConsolidado = this.consolidarPorCategoria(detalleCombinado);
                  const detalleConNombre = detalleConsolidado.map((item: any) => ({
                    ...item,
                    categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
                  }));
                  const detalleCompleto = detalleConNombre;
                  const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleCompleto);

                  if (!detalleCombinado.length && idx < candidatos.length - 1) {
                    intentarCategoria(idx + 1);
                    return;
                  }

                  this.tableData = detalleOrdenado;

                  this.totalCuotaCategoria = detalleOrdenado.reduce(
                    (sum: number, item: any) => sum + (Number(item?.cuota ?? 0) || 0),
                    0,
                  );

                  this.totalAcumuladoCategoria = detalleOrdenado.reduce(
                    (sum: number, item: any) =>
                      sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                    0,
                  );

                  const topCategorias = [...detalleCompleto]
                    .map((i: any) => ({
                      name: this.obtenerNombreCategoria(i) || 'Sin categoría',
                      value: Number(i?.acumulado ?? i?.ventaAcum ?? 0),
                    }))
                    .sort((a: any, b: any) => b.value - a.value)
                    .slice(0, 15);

                  this.totalTopCategorias = topCategorias.reduce(
                    (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
                    0,
                  );

                  this.chartData = topCategorias;
                  this.chartId = 'chart-categoria-' + Date.now();
                  this.cdr.markForCheck();
                });
            } else {
              // Una sola categoría o ninguna - llamada normal
              const categorias$ = this.esSemanal
                ? this.semanaService.getCuotaCategoriaPorVendedor(
                    this._codigoVendedor,
                    filtrosActivos,
                  )
                : this.cumplimientoService.getCuotaCategoriaPorVendedor(
                    this._codigoVendedor,
                    filtrosActivos,
                  );

              categorias$
                .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
                .subscribe((res: any) => {
                  console.debug('[Ventas-VendedorBase] Respuesta de categorías del backend:', res);
                  
                  const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
                  const categoriasSeleccionadas = categoriasSeleccionadasOriginales.length
                    ? categoriasSeleccionadasOriginales
                    : Array.isArray(filtrosActivos.categoriaNombres)
                      ? filtrosActivos.categoriaNombres.filter(Boolean)
                      : Array.isArray(filtrosActivos.categorias)
                        ? filtrosActivos.categorias.filter(Boolean)
                        : [];
                        
                  console.debug('[Ventas-VendedorBase] Categorías a filtrar:', categoriasSeleccionadas);
                  
                  const categoriaFiltroActivos = categoriasSeleccionadas.length
                    ? categoriasSeleccionadas
                    : filtrosActivos.categoria;
                    
                  const detalleFiltrado = this.filtrarCategoriasReales(
                    detalle,
                    categoriaFiltroActivos,
                  );
                  
                  console.debug('[Ventas-VendedorBase] Detalle filtrado:', detalleFiltrado.length, 'registros');
                  
                  const detalleConsolidado = this.consolidarPorCategoria(detalleFiltrado);
                  const detalleConNombre = detalleConsolidado.map((item: any) => ({
                    ...item,
                    categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
                  }));
                  const detalleCompleto = detalleConNombre;
                  const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleCompleto);

                  if (!detalleFiltrado.length && idx < candidatos.length - 1) {
                    intentarCategoria(idx + 1);
                    return;
                  }

                  this.tableData = detalleOrdenado;

                  this.totalCuotaCategoria = detalleOrdenado.reduce(
                    (sum: number, item: any) => sum + (Number(item?.cuota ?? 0) || 0),
                    0,
                  );

                  this.totalAcumuladoCategoria = detalleOrdenado.reduce(
                    (sum: number, item: any) =>
                      sum + (Number(item?.acumulado ?? item?.ventaAcum ?? 0) || 0),
                    0,
                  );

                  const topCategorias = [...detalleCompleto]
                    .map((i: any) => ({
                      name: this.obtenerNombreCategoria(i) || 'Sin categoría',
                      value: Number(i?.acumulado ?? i?.ventaAcum ?? 0),
                    }))
                    .sort((a: any, b: any) => b.value - a.value)
                    .slice(0, 15);

                  this.totalTopCategorias = topCategorias.reduce(
                    (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
                    0,
                  );

                  this.chartData = topCategorias;
                  this.chartId = 'chart-categoria-' + Date.now();
                  this.cdr.markForCheck();
                });
            }
          };

          intentarCategoria(0);
        }
        break;

      case 'ciudad':
        this.chartType = 'pie';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCiudad = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const codigoCiudadActivo = String(filtrosActivos.ciudad ?? '').trim();
            const ciudades$ = this.esSemanal
              ? this.semanaService.getCiudadesPorVendedor(this._codigoVendedor, filtrosActivos)
              : codigoCiudadActivo
                ? this.cumplimientoService.getDetallePorCiudad(
                    this._codigoVendedor,
                    codigoCiudadActivo,
                    filtrosActivos,
                  )
                : this.cumplimientoService.getCiudadesPorVendedor(
                    this._codigoVendedor,
                    filtrosActivos,
                  );

            ciudades$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listadoCompleto = res?.detallePorCiudad ?? [];
                const listadoFiltrado = this.filtrarPorCiudadSeleccionada(listadoCompleto);

                if (!listadoFiltrado.length && idx < candidatos.length - 1) {
                  intentarCiudad(idx + 1);
                  return;
                }

                const consolidado = this.consolidarPorCiudad(listadoFiltrado);
                const listadoMapeado = consolidado.map((i: any) => ({
                  ...i,
                  ciudad: this.repararTextoCiudad(i.ciudad),
                }));
                const ordenadoCiudades = [...listadoMapeado].sort((a: any, b: any) =>
                  this.repararTextoCiudad(a?.ciudad).localeCompare(
                    this.repararTextoCiudad(b?.ciudad),
                    'es',
                  ),
                );
                const topCiudades = [...listadoMapeado]
                  .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                  .slice(0, 15);
                this.tableData = ordenadoCiudades;
                this.totalAcumuladoCiudad = ordenadoCiudades.reduce(
                  (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
                  0,
                );
                this.totalTopCiudades = topCiudades.reduce(
                  (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                  0,
                );
                // Total cuota por ciudad
                this.totalCuotaCiudad = ordenadoCiudades.reduce(
                  (sum: number, item: any) => sum + (Number(item?.cuota ?? item?.cuotaLinea ?? 0) || 0),
                  0,
                );
                this.chartData = topCiudades.map((i: any) => ({
                  name: this.repararTextoCiudad(i.ciudad),
                  value: i.ventaAcum,
                }));
                this.cdr.markForCheck();
              });
          };

          intentarCiudad(0);
        }
        break;

      case 'item':
        this.chartType = 'bar';

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarItem = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            const items$ = this.esSemanal
              ? this.semanaService.getProductosPorVendedor(this._codigoVendedor, filtrosActivos)
              : this.cumplimientoService.getProductosPorVendedor(
                  this._codigoVendedor,
                  filtrosActivos,
                );

            items$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listado = res?.data ?? [];

                if (!listado.length && idx < candidatos.length - 1) {
                  intentarItem(idx + 1);
                  return;
                }

                const listadoOrdenado = this.ordenarDetalleItemsPorFechaAsc(listado);
                this.allItemData = listadoOrdenado;
                this.tableData = [...listadoOrdenado];
                this.recalcularChart();
              });
          };

          intentarItem(0);
        }
        break;

      case 'cliente':
        this.chartType = 'bar';

        const idVendedor = this.obtenerIdVendedorSesion();
        if (!idVendedor) {
          this.clientesAgrupados = [];
          this.clientesVista = [];
          this.totalClientesFiltrados = 0;
          this.tableData = [];
          this.chartData = [];
          this.cdr.markForCheck();
          return;
        }

        this.cargandoClientes = true;

        {
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCliente = (idx: number): void => {
            const filtrosActivos = candidatos[idx];

            this.cumplimientoService
              .getProductosPorCliente(idVendedor, filtrosActivos)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe({
                next: (res: any) => {
                  const listado = Array.isArray(res?.data) ? res.data : [];

                  if (!listado.length && idx < candidatos.length - 1) {
                    intentarCliente(idx + 1);
                    return;
                  }

                  const detalleClientes = this.construirDetalleClientes(listado);
                  const topClientes = [...detalleClientes]
                    .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                    .slice(0, 15);

                  this.totalTopClientes = topClientes.reduce(
                    (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                    0,
                  );

                  this.clientesAgrupados = detalleClientes;
                  this.clientesVisibles = this.clientesPageSize;
                  this.actualizarClientesVista();
                  this.tableData = detalleClientes;
                  this.chartData = topClientes.map((i: any) => ({
                    name: i.cliente,
                    value: i.ventaAcum,
                  }));
                  this.cargandoClientes = false;
                  this.cdr.markForCheck();
                },
                error: () => {
                  if (idx < candidatos.length - 1) {
                    intentarCliente(idx + 1);
                    return;
                  }

                  this.cargandoClientes = false;
                  this.clientesAgrupados = [];
                  this.clientesVista = [];
                  this.totalClientesFiltrados = 0;
                  this.tableData = [];
                  this.chartData = [];
                  this.cdr.markForCheck();
                },
              });
          };

          intentarCliente(0);
        }
        break;
    }
  }

  // For dashboard parent to force a reload when filters/tipoCuota change
  public reloadView(force = true): void {
    this.solicitarCargaVista(!!force);
  }

  // ─── CUOTA DIARIA ──────────────────────────────────────────────────────────────

  protected cargarVentasCuotaDiaria(filtros: DashboardFilters): void {
    const fechaInicio = String(filtros.fechaInicio ?? '').trim();
    const fechaFin = String(filtros.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaVendedor({ fechaInicio, fechaFin })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((cuotas: CuotaDiaVendedor[]) => {
        this.cuotasDiariasCache = cuotas;

        if (!cuotas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotasMapeadas = this.mapearCuotaDiariaData(cuotas);

        this.tableData = cuotasMapeadas;

        this.totalCuotaDiaria = cuotasMapeadas.reduce(
          (sum, item) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
          0,
        );

        this.chartData = [
          { name: 'Cuota Diaria', value: this.totalCuotaDiaria },
          { name: 'Venta Acumulada', value: cuotasMapeadas.reduce((s, i) => s + (Number(i.ventaAcum ?? 0) || 0), 0) },
          { name: 'Proyección', value: cuotasMapeadas.reduce((s, i) => s + (Number(i.proyeccionVenta ?? 0) || 0), 0) },
        ];

        this.cdr.markForCheck();
      });
  }

  protected cargarVendedorCuotaDiaria(filtros: DashboardFilters): void {
    const fechaInicio = String(filtros.fechaInicio ?? '').trim();
    const fechaFin = String(filtros.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaVendedor({ fechaInicio, fechaFin })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((cuotas: CuotaDiaVendedor[]) => {
        this.cuotasDiariasCache = cuotas;

        if (!cuotas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotasMapeadas = this.mapearCuotaDiariaData(cuotas);

        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);

        this.tableData = cuotasFiltradas;

        this.totalCuotaDiaria = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
          0,
        );

        this.totalCuotaVendedor = this.totalCuotaDiaria;
        this.totalAcumuladoVendedor = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.ventaAcum ?? 0) || 0),
          0,
        );

        const topVendedores = [...cuotasFiltradas]
          .sort((a, b) => Number(b.ventaAcum ?? 0) - Number(a.ventaAcum ?? 0))
          .slice(0, 15);

        this.totalTopVendedores = topVendedores.reduce(
          (sum, item) => sum + (Number(item.ventaAcum ?? 0) || 0),
          0,
        );

        this.chartData = topVendedores.map((item) => ({
          name: item.nombre ?? item.codVendedor,
          value: Number(item.ventaAcum ?? 0),
        }));

        this.cdr.markForCheck();
      });
  }

  protected cargarVendedorCuotaDiariaAdmin(filtros: DashboardFilters): void {
    const fechaInicio = String(filtros.fechaInicio ?? '').trim();
    const fechaFin = String(filtros.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaAdmin({ fechaInicio, fechaFin })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((cuotas: CuotaDiaVendedor[]) => {
        this.cuotasDiariasCache = cuotas;

        if (!cuotas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotasMapeadas = this.mapearCuotaDiariaData(cuotas);
        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);

        this.tableData = cuotasFiltradas;

        this.totalCuotaDiaria = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
          0,
        );

        this.totalCuotaVendedor = this.totalCuotaDiaria;
        this.totalAcumuladoVendedor = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.ventaAcum ?? 0) || 0),
          0,
        );

        const topVendedores = [...cuotasFiltradas]
          .sort((a, b) => Number(b.ventaAcum ?? 0) - Number(a.ventaAcum ?? 0))
          .slice(0, 15);

        this.totalTopVendedores = topVendedores.reduce(
          (sum, item) => sum + (Number(item.ventaAcum ?? 0) || 0),
          0,
        );

        this.chartData = topVendedores.map((item) => ({
          name: item.nombre ?? item.codVendedor,
          value: Number(item.ventaAcum ?? 0),
        }));

        this.cdr.markForCheck();
      });
  }

  protected cargarVendedorCuotaDiariaSupervisor(filtros: DashboardFilters): void {
    const fechaInicio = String(filtros.fechaInicio ?? '').trim();
    const fechaFin = String(filtros.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    const idSupervisor = this.obtenerIdSupervisorSesion();

    if (!idSupervisor) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaSupervisor({ fechaInicio, fechaFin, idSupervisor })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((response) => {
        const cuotas = response?.success && Array.isArray(response.data) ? response.data : [];
        this.cuotasDiariasCache = cuotas;

        if (!cuotas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotasMapeadas = this.mapearCuotaDiariaData(cuotas);
        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);

        this.tableData = cuotasFiltradas;

        this.totalCuotaDiaria = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
          0,
        );

        this.totalCuotaVendedor = this.totalCuotaDiaria;
        this.totalAcumuladoVendedor = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.ventaAcum ?? 0) || 0),
          0,
        );

        const topVendedores = [...cuotasFiltradas]
          .sort((a, b) => Number(b.ventaAcum ?? 0) - Number(a.ventaAcum ?? 0))
          .slice(0, 15);

        this.totalTopVendedores = topVendedores.reduce(
          (sum, item) => sum + (Number(item.ventaAcum ?? 0) || 0),
          0,
        );

        this.chartData = topVendedores.map((item) => ({
          name: item.nombre ?? item.codVendedor,
          value: Number(item.ventaAcum ?? 0),
        }));

        this.cdr.markForCheck();
      });
  }

  protected override mapearCuotaDiariaData(cuotas: CuotaDiaVendedor[]): any[] {
    return cuotas.map((cuota) => {
      const vendedor = cuota.usuario?.vendedor;
      return {
        codVendedor: vendedor?.codigo_vendedor ?? '',
        nombre: vendedor?.nombre ?? '',
        cuotaDiaria: Number(cuota.cuota_dia ?? 0),
        ventaAcum: Number(cuota.venta_acumulada_dia ?? 0),
        porcCump: Number(cuota.pct_cumplimiento ?? 0),
        proyeccionVenta: Number(cuota.proye_venta ?? 0),
        porcCumProy: Number(cuota.pct_cumplimiento ?? 0),
      };
    });
  }
}
