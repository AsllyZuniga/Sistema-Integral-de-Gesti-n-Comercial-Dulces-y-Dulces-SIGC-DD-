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

    const tieneProveedor = this.normalizarValoresFiltro(filtrosConsulta.proveedores, filtrosConsulta.proveedor).length > 0;
    const codigosProveedorFiltro = this.normalizarValoresFiltro(filtrosConsulta.proveedores, filtrosConsulta.proveedor);
    const tieneCiudad = this.normalizarValoresFiltro(filtrosConsulta.ciudades, filtrosConsulta.ciudad ?? filtrosConsulta.ciudadNombre).length > 0;
    const codigosCiudadFiltro = this.normalizarValoresFiltro(filtrosConsulta.ciudades, filtrosConsulta.ciudad ?? filtrosConsulta.ciudadNombre);

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
          // El backend acepta proveedor/proveedores junto con los demás filtros.
          // No quitamos proveedor ni hacemos doble filtro local para no borrar
          // resultados válidos por diferencias entre value y label.
          const lineas$ = this.esSemanal
            ? this.semanaService.getLineasPorVendedor(this._codigoVendedor, filtrosConsulta)
            : this.cumplimientoService.getLineasPorVendedor(
                this._codigoVendedor,
                filtrosConsulta,
              );

          lineas$
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((res: any) => {
              const filtrado = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
              const consolidado = this.consolidarPorLinea(filtrado);
              const listadoTabla = this.ordenarProveedoresPorAlfabeto(consolidado);
              const topProveedores = this.limitarTopProveedores(consolidado);
              this.tableData = listadoTabla;
              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea,
                value: i.ventaAcum,
              }));
              this.cdr.markForCheck();
            });
        } else if (tieneCiudad) {
          // Usar el endpoint consolidado con todos los filtros activos.
          // El drill-down por URL solo soportaba una ciudad y podía perder proveedor/categoría.
          const ciudades$ = this.esSemanal
            ? this.semanaService.getCiudadesGlobal(filtrosConsulta)
            : this.cumplimientoService.getCiudadesGlobal(filtrosConsulta);

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
            const lineas$ = this.esSemanal
              ? this.semanaService.getLineasPorVendedor(this._codigoVendedor, filtrosActivos)
              : this.cumplimientoService.getLineasPorVendedor(
                  this._codigoVendedor,
                  filtrosActivos,
                );

            lineas$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listadoMapeado = this.mapearCuotaPorLinea(res?.detallePorLinea ?? []);
                const proveedoresSeleccionados = this.normalizarValoresFiltro(
                  filtrosActivos.proveedores,
                  filtrosActivos.proveedor,
                );
                let listadoFiltrado = proveedoresSeleccionados.length
                  ? this.filtrarProveedoresMulti(listadoMapeado, proveedoresSeleccionados)
                  : listadoMapeado;

                // FIX: getLineasPorVendedor devuelve TODOS los proveedores con
                // cuota asignada al vendedor (venta=0 si no vendió bajo el
                // filtro de categoria/ciudad aplicado), en vez de solo los que
                // realmente tuvieron venta bajo ese filtro. Si hay categoria o
                // ciudad seleccionada, se descartan las filas sin venta real
                // para que la tabla muestre solo los proveedores que aplican.
                const categoriasSeleccionadas = this.normalizarValoresFiltro(
                  filtrosActivos.categorias,
                  filtrosActivos.categoria,
                );
                const ciudadesSeleccionadas = this.normalizarValoresFiltro(
                  filtrosActivos.ciudades,
                  filtrosActivos.ciudad ?? filtrosActivos.ciudadNombre,
                );
                if (categoriasSeleccionadas.length || ciudadesSeleccionadas.length) {
                  listadoFiltrado = listadoFiltrado.filter(
                    (item: any) => Number(item?.ventaAcum ?? 0) !== 0,
                  );
                }

                if (!listadoFiltrado.length && idx < candidatos.length - 1) {
                  intentarProveedor(idx + 1);
                  return;
                }

                // Fusionar filas del mismo proveedor con distinto código de
                // reporte y quitar el código antepuesto del nombre mostrado.
                const listadoConsolidado = this.consolidarPorLinea(listadoFiltrado);
                const listadoTabla = this.ordenarProveedoresPorAlfabeto(listadoConsolidado);
                const topProveedores = [...listadoConsolidado]
                  .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                  .slice(0, 12);

                this.totalTopProveedores = topProveedores.reduce(
                  (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                  0,
                );
                this.liderVentasProveedor = this.nombreProveedorCard(
                  topProveedores[0]?.linea ?? '—',
                );

                this.tableData = listadoTabla;
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

          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarCategoria = (idx: number): void => {
            const filtrosActivos = candidatos[idx];

            // OPTIMIZACION: 1 sola llamada al endpoint /cuota-categoria/general
            // (role-aware desde JWT). Antes: getCuotaCategoriaPorVendedor que
            // devolvía 404 si el vendedor no tenía cuotas explícitas.
            const categorias$ = this.cumplimientoService.getCuotaCategoriaGeneral(filtrosActivos);

            categorias$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
                const categoriasSeleccionadas = categoriasSeleccionadasOriginales.length
                  ? categoriasSeleccionadasOriginales
                  : Array.isArray(filtrosActivos.categoriaNombres)
                    ? filtrosActivos.categoriaNombres.filter(Boolean)
                    : Array.isArray(filtrosActivos.categorias)
                      ? filtrosActivos.categorias.filter(Boolean)
                      : [];

                const categoriaFiltroActivos = categoriasSeleccionadas.length
                  ? categoriasSeleccionadas
                  : filtrosActivos.categoria;

                const detalleFiltrado = this.filtrarCategoriasReales(
                  detalle,
                  categoriaFiltroActivos,
                );

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
            // Usar siempre el endpoint consolidado con TODOS los filtros activos.
            // El backend acepta ciudad/codCiudad y vendedor/proveedor/categorias;
            // el drill-down por URL solo soportaba una ciudad y podía perder filtros multi.
            const ciudadesSeleccionadas = this.normalizarValoresFiltro(
              filtrosActivos.ciudades,
              filtrosActivos.ciudad,
            );

            // Refuerzo para multi-ciudad: si el backend solo responde la primera
            // ciudad al recibir ciudad=71,72, hacemos una llamada por ciudad y
            // consolidamos para que la tabla muestre todas las seleccionadas.
            const ciudades$ = ciudadesSeleccionadas.length > 1
              ? forkJoin(
                  ciudadesSeleccionadas.map((codigoCiudad) => {
                    const filtrosCiudad: DashboardFilters = {
                      ...filtrosActivos,
                      ciudad: codigoCiudad,
                      ciudades: [codigoCiudad],
                      ciudadNombre: '',
                      ciudadesNombres: [],
                    };
                    return this.esSemanal
                      ? this.semanaService.getCiudadesGlobal(filtrosCiudad)
                      : this.cumplimientoService.getCiudadesGlobal(filtrosCiudad);
                  }),
                )
              : this.esSemanal
                ? this.semanaService.getCiudadesGlobal(filtrosActivos)
                : this.cumplimientoService.getCiudadesGlobal(filtrosActivos);

            ciudades$
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                const listadoCompleto = Array.isArray(res)
                  ? res.flatMap((item: any) => Array.isArray(item?.detallePorCiudad) ? item.detallePorCiudad : [])
                  : res?.detallePorCiudad ?? [];
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
          // Issue #3: el endpoint único role-aware filtra por scope JWT.
          // El backend decide si es admin/supervisor/vendedor. La vista
          // semanal y mensual usan el mismo endpoint (mismo backend, solo
          // cambia el rango de fechas en filtros).
          const candidatos = this.debeAplicarFallbackAutomatico(filtrosConsulta)
            ? this.construirCandidatosFallback(filtrosConsulta)
            : [filtrosConsulta];

          const intentarItem = (idx: number): void => {
            const filtrosActivos = candidatos[idx];
            this.cumplimientoService
              .getItemsVendidos(filtrosActivos)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((res: any) => {
                // Issue #3 (front): /api/items-vendidos responde
                // { data: { rows: [...] } }. Soportar ambos shapes.
                const data = res?.data;
                const listado = Array.isArray(data)
                  ? data
                  : Array.isArray(data?.rows)
                    ? data.rows
                    : [];

                if (!listado.length && idx < candidatos.length - 1) {
                  intentarItem(idx + 1);
                  return;
                }

                // Mapeo al shape esperado por la vista: el backend devuelve
                // {proveedor, codigo_item, descripcion, unidades_cajas, subtotal};
                // la vista usa Cod_Item/Descripcion/Cantidad/Subtotal.
                const listadoMapeado = listado.map((item: any) => ({
                  ...item,
                  Proveedor: item?.proveedor,
                  Cod_Item: item?.codigo_item,
                  Descripcion: item?.descripcion,
                  Cantidad: Number(item?.unidades_cajas ?? 0),
                  Subtotal: Number(item?.subtotal ?? 0),
                  Venta_Unid_Cajas: Number(item?.unidades_cajas ?? 0),
                }));
                this.allItemData = listadoMapeado;
                this.tableData = [...listadoMapeado];
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

    // FIX: cuotaDiaService.getCuotaDiaVendedor no soporta proveedor/categoria/
    // ciudad, por lo que la tabla/chart nunca reflejaban esos filtros para el
    // rol vendedor. getCumplimientoDiaVendedor (/dia/cumplimiento/front/me)
    // sí los soporta y devuelve un objeto plano para el vendedor autenticado.
    this.cumplimientoService
      .getCumplimientoDiaVendedor(filtros)
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((res: any) => {
        const cuotaDia = Number(res?.cuotaDia ?? 0) || 0;
        const ventaDiaria = Number(res?.ventaDiaria ?? 0) || 0;
        const proyeccion = Number(res?.proyeccion ?? 0) || 0;

        if (!cuotaDia && !ventaDiaria) {
          this.cuotasDiariasCache = [];
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const filaMapeada = {
          codVendedor: res?.codigoVendedor ?? this._codigoVendedor,
          nombre: res?.nombre ?? '',
          cuotaDiaria: cuotaDia,
          ventaAcum: ventaDiaria,
          porcCump: Number(res?.cumplimiento ?? 0) || 0,
          proyeccionVenta: proyeccion,
          porcCumProy: Number(res?.cumplimientoProyectado ?? 0) || 0,
        };
        this.cuotasDiariasCache = [filaMapeada] as any;

        this.tableData = [filaMapeada];
        this.totalCuotaDiaria = cuotaDia;

        this.chartData = [
          { name: 'Cuota Diaria', value: cuotaDia },
          { name: 'Venta Acumulada', value: ventaDiaria },
          { name: 'Proyección', value: proyeccion },
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

    // FIX: cuotaDiaService.getCuotaDiaVendedor no soporta proveedor/categoria/
    // ciudad. getCumplimientoDiaVendedor (/dia/cumplimiento/front/me) sí, y
    // devuelve un objeto plano (siempre 1 vendedor: el autenticado).
    this.cumplimientoService
      .getCumplimientoDiaVendedor(filtros)
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((res: any) => {
        const cuotaDia = Number(res?.cuotaDia ?? 0) || 0;
        const ventaDiaria = Number(res?.ventaDiaria ?? 0) || 0;

        if (!cuotaDia && !ventaDiaria) {
          this.cuotasDiariasCache = [];
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const filaMapeada = {
          codVendedor: res?.codigoVendedor ?? this._codigoVendedor,
          nombre: res?.nombre ?? '',
          cuotaDiaria: cuotaDia,
          ventaAcum: ventaDiaria,
          porcCump: Number(res?.cumplimiento ?? 0) || 0,
          proyeccionVenta: Number(res?.proyeccion ?? 0) || 0,
          porcCumProy: Number(res?.cumplimientoProyectado ?? 0) || 0,
        };
        this.cuotasDiariasCache = [filaMapeada] as any;

        this.tableData = [filaMapeada];
        this.totalCuotaDiaria = cuotaDia;
        this.totalCuotaVendedor = cuotaDia;
        this.totalAcumuladoVendedor = ventaDiaria;
        this.totalTopVendedores = ventaDiaria;

        this.chartData = [
          {
            name: filaMapeada.nombre || filaMapeada.codVendedor,
            value: ventaDiaria,
          },
        ];

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

    // FIX: usar el MISMO endpoint que las cards del administrador
    // (cumplimientoService /dia/cumplimiento/front) en lugar de
    // cuotaDiaService /api/cuota-dia/por-dia. Garantiza que la card
    // "Venta Diaria" y el total acumulado de la tabla coincidan.
    this.cumplimientoService
      .getCumplimientoDiaAdmin(filtros)
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((res: any) => {
        const totalesApi = res?.totales ?? null;
        const cuotasMapeadas = this.mapearCuotaDiariaAdminDesdeCumplimiento(res);
        this.cuotasDiariasCache = cuotasMapeadas as any;

        if (!cuotasMapeadas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.emitirResumenVista();
          this.cdr.markForCheck();
          return;
        }

        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);

        this.tableData = [...cuotasFiltradas].sort((a: any, b: any) => {
          const codigoA = this.normalizarCodigoVendedor(a?.codVendedor ?? '');
          const codigoB = this.normalizarCodigoVendedor(b?.codVendedor ?? '');
          return codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
        });

        this.totalCuotaDiaria = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
          0,
        );

        this.totalCuotaVendedor = this.totalCuotaDiaria;
        // FIX: misma fuente única que la card.
        this.totalAcumuladoVendedor = this.obtenerVentaAcumUnificadaCuotaDiaria(
          cuotasFiltradas,
          totalesApi,
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

        this.emitirResumenVista();
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

    // FIX: /dia/cumplimiento/supervisor/:id devuelve un timeseries por DIA
    // (sin codVendedor por fila), por lo que mapearCuotaDiariaAdminDesdeCumplimiento
    // no encontraba ningún vendedor y la tabla quedaba vacía. /dia/cumplimiento/front
    // es role-aware por JWT (admin todos, supervisor su equipo) y devuelve
    // una fila por vendedor, igual que admin.
    this.cumplimientoService
      .getCumplimientoDiaAdmin(filtros)
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((res: any) => {
        const totalesApi = res?.totales ?? null;
        const cuotasMapeadas = this.mapearCuotaDiariaAdminDesdeCumplimiento(res);
        this.cuotasDiariasCache = cuotasMapeadas as any;

        if (!cuotasMapeadas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.emitirResumenVista();
          this.cdr.markForCheck();
          return;
        }

        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);

        this.tableData = [...cuotasFiltradas].sort((a: any, b: any) => {
          const codigoA = this.normalizarCodigoVendedor(a?.codVendedor ?? '');
          const codigoB = this.normalizarCodigoVendedor(b?.codVendedor ?? '');
          return codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
        });

        this.totalCuotaDiaria = cuotasFiltradas.reduce(
          (sum, item) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
          0,
        );

        this.totalCuotaVendedor = this.totalCuotaDiaria;
        // FIX: misma fuente única que la card.
        this.totalAcumuladoVendedor = this.obtenerVentaAcumUnificadaCuotaDiaria(
          cuotasFiltradas,
          totalesApi,
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

        this.emitirResumenVista();
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
