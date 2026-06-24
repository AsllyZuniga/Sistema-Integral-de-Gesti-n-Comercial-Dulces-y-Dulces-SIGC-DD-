import { Directive } from '@angular/core';
import { merge, takeUntil } from 'rxjs';
import { DashboardFilters } from '../../../../../../shared/components/filters/filters.component';
import { VentasUtilidadesBase } from '../../services/ventas-utilidades-base';

@Directive()
export abstract class VentasAdministradorBase extends VentasUtilidadesBase {
  protected cargarVistaAdminTodos(filtrosConsulta: DashboardFilters): void {
    // Antes: se borraba `vendedor` cuando la vista era 'ciudad' para que el endpoint
    // global no lo recibiera. Ahora la iteración per-vendor respeta el filtro
    // gracias a `filtrarCodigosPorFiltroVendedor`, por lo que el filtro se
    // mantiene en todos los casos.
    const filtrosAdmin = filtrosConsulta;

    const admin$ = this.esSemanal
      ? this.semanaService.getCumplimientoSemanaAdmin(filtrosAdmin)
      : this.cumplimientoService.getCumplimientoMesAdmin(filtrosAdmin);

    switch (this.activeVentasView) {
      case 'categoria':
        this.chartType = 'bar';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigosBase = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);
          const codigos = this.filtrarCodigosPorFiltroVendedor(codigosBase, filtrosConsulta);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              this.esSemanal
                ? this.semanaService.getCuotaCategoriaPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getCuotaCategoriaPorVendedor(
                    codigo,
                    filtrosConsulta,
                  ),
            (res) => (Array.isArray(res?.detalle) ? res.detalle : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((detalleBruto: any[]) => {
              const categoriasSeleccionadas =
                Array.isArray(filtrosConsulta.categorias) && filtrosConsulta.categorias.length
                  ? filtrosConsulta.categorias.filter(Boolean)
                  : Array.isArray(filtrosConsulta.categoriaNombres)
                    ? filtrosConsulta.categoriaNombres.filter(Boolean)
                    : [];
              const categoriaFiltro = categoriasSeleccionadas.length
                ? categoriasSeleccionadas
                : filtrosConsulta.categoria;

              const detalleFiltrado = this.filtrarCategoriasReales(detalleBruto, categoriaFiltro);
              const detalleConsolidado = this.consolidarPorCategoria(detalleFiltrado);
              const detalleConNombre = detalleConsolidado.map((item: any) => ({
                ...item,
                categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
              }));
              const detalleCompleto = detalleConNombre;
              const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleCompleto);

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
              this.chartId = 'chart-categoria-admin-' + Date.now();
              this.emitirResumenVista();
              this.cdr.markForCheck();
            });
          return;
        }
        this.cumplimientoService
          .getCuotaCategoriaGeneral(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const pintarCategoria = (detalleRaw: any[]) => {
              const detallePermitido = this.filtrarPorCodigosVendedoresPermitidos(detalleRaw);
              const categoriasSeleccionadas =
                Array.isArray(filtrosConsulta.categorias) && filtrosConsulta.categorias.length
                  ? filtrosConsulta.categorias.filter(Boolean)
                  : Array.isArray(filtrosConsulta.categoriaNombres)
                    ? filtrosConsulta.categoriaNombres.filter(Boolean)
                    : [];
              const categoriaFiltroInner = categoriasSeleccionadas.length
                ? categoriasSeleccionadas
                : filtrosConsulta.categoria;

              const detalleFiltrado = this.filtrarCategoriasReales(
                detallePermitido,
                categoriaFiltroInner,
              );
              const detalleConsolidado = this.consolidarPorCategoria(detalleFiltrado);
              const detalleConNombre = detalleConsolidado.map((item: any) => ({
                ...item,
                categoria: this.obtenerNombreCategoria(item) || 'Sin categoría',
              }));
              const detalleCompleto = detalleConNombre;
              const detalleOrdenado = this.ordenarCategoriasPorAlfabeto(detalleCompleto);

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
              this.chartId = 'chart-categoria-admin-' + Date.now();
              this.emitirResumenVista();
              this.cdr.markForCheck();
            };

            const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
            if (detalle.length > 0) {
              pintarCategoria(detalle);
              return;
            }

            this.cumplimientoService
              .getCuotaCategoriasPorVendedores(filtrosConsulta)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((fallback: any) => {
                const detalleFallback = Array.isArray(fallback?.detalle) ? fallback.detalle : [];
                pintarCategoria(detalleFallback);
              });
          });
        return;

      case 'proveedor':
        this.chartType = 'bar';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigosBase = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);
          const codigos = this.filtrarCodigosPorFiltroVendedor(codigosBase, filtrosConsulta);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              this.esSemanal
                ? this.semanaService.getLineasPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getLineasPorVendedor(codigo, filtrosConsulta),
            (res) => (Array.isArray(res?.detallePorLinea) ? res.detallePorLinea : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((lineas: any[]) => {
              const detalleMapeado = lineas.map((item: any) => ({
                ...item,
                linea:
                  item?.linea ?? item?.codigoLinea ?? item?.reporteProvConObs ?? 'Sin proveedor',
                cuotaLinea: Number(item?.cuotaProveedorTotal ?? 0) || 0,
                ventaAcum: Number(item?.ventaAcum ?? 0) || 0,
                porcCump: Number(item?.porcCump ?? 0) || 0,
                proyeccionVenta: Number(item?.proyeccionVenta ?? 0) || 0,
                porcCumProy: Number(item?.porcCumProy ?? 0) || 0,
              }));

              const detalleConsolidado = this.consolidarPorLinea(detalleMapeado);
              const filtrado = this.filtrarProveedores(
                detalleConsolidado,
                filtrosConsulta.proveedor,
              );
              const ordenado = this.ordenarProveedoresPorAlfabeto(filtrado);

              this.tableData = ordenado;
              this.totalCuotaProveedor = ordenado.reduce(
                (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
                0,
              );
              this.totalAcumuladoProveedor = ordenado.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );

              const topProveedores = [...ordenado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);

              this.totalTopProveedores = topProveedores.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.liderVentasProveedor = topProveedores[0]?.linea ?? '—';

              this.chartData = topProveedores.map((i: any) => ({
                name: i.linea ?? 'Sin dato',
                value: Number(i?.ventaAcum ?? 0),
              }));
              this.chartId = 'chart-proveedor-admin-' + Date.now();
              this.emitirResumenVista();
              this.cdr.markForCheck();
            });
          return;
        }
        this.cumplimientoService
          .getLineasAdmin(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const lineas = Array.isArray(res?.detallePorLinea) ? res.detallePorLinea : [];
            const lineasPermitidas = this.filtrarPorCodigosVendedoresPermitidos(lineas);

            // Mapear campos del endpoint a formato de tabla
            const detalleMapeado = lineasPermitidas.map((item: any) => ({
              ...item,
              linea: item?.linea ?? item?.codigoLinea ?? item?.reporteProvConObs ?? 'Sin proveedor',
              cuotaLinea: Number(item?.cuotaProveedorTotal ?? 0) || 0,
              ventaAcum: Number(item?.ventaAcum ?? 0) || 0,
              porcCump: Number(item?.porcCump ?? 0) || 0,
              proyeccionVenta: Number(item?.proyeccionVenta ?? 0) || 0,
              porcCumProy: Number(item?.porcCumProy ?? 0) || 0,
            }));

            const filtrado = this.filtrarProveedores(detalleMapeado, filtrosConsulta.proveedor);
            const ordenado = this.ordenarProveedoresPorAlfabeto(filtrado);

            this.tableData = ordenado;
            this.totalCuotaProveedor = ordenado.reduce(
              (sum: number, item: any) => sum + (Number(item?.cuotaLinea ?? 0) || 0),
              0,
            );
            this.totalAcumuladoProveedor = ordenado.reduce(
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
              0,
            );

            const topProveedores = [...ordenado]
              .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
              .slice(0, 12);

            this.totalTopProveedores = topProveedores.reduce(
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
              0,
            );
            this.liderVentasProveedor = topProveedores[0]?.linea ?? '—';

            this.chartData = topProveedores.map((i: any) => ({
              name: i.linea ?? 'Sin dato',
              value: Number(i?.ventaAcum ?? 0),
            }));
            this.chartId = 'chart-proveedor-admin-' + Date.now();
            this.emitirResumenVista();
            this.cdr.markForCheck();
          });
        return;

      case 'ciudad':
        this.chartType = 'pie';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigosBase = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);
          const codigos = this.filtrarCodigosPorFiltroVendedor(codigosBase, filtrosConsulta);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              this.esSemanal
                ? this.semanaService.getCiudadesPorVendedor(codigo, filtrosConsulta)
                : this.cumplimientoService.getCiudadesPorVendedor(codigo, filtrosConsulta),
            (res) => (Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((ciudadesRaw: any[]) => {
              if (!ciudadesRaw.length) {
                this.tableData = [];
                this.chartData = [];
                this.totalAcumuladoCiudad = 0;
                this.cdr.markForCheck();
                return;
              }

              const consolidado = this.consolidarPorCiudad(ciudadesRaw);

              const filtrado = this.filtrarPorCiudadSeleccionada(consolidado);
              const ordenado = [...filtrado].sort((a: any, b: any) =>
                this.repararTextoCiudad(a?.ciudad).localeCompare(
                  this.repararTextoCiudad(b?.ciudad),
                  'es',
                ),
              );
              const topCiudades = [...filtrado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 15);

              this.tableData = ordenado;
              this.totalAcumuladoCiudad = ordenado.reduce(
                (sum: number, item: any) =>
                  sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
                0,
              );
              this.totalTopCiudades = topCiudades.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.chartData = topCiudades.map((i: any) => ({
                name: this.repararTextoCiudad(i?.ciudad),
                value: Number(i?.ventaAcum ?? 0),
              }));
              this.chartId = 'chart-ciudad-admin-' + Date.now();
              this.cdr.markForCheck();
            });
          return;
        }
        this.cumplimientoService
          .getCiudadesGlobal(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const ciudadesRaw = Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
            const ciudadesPermitidas = this.filtrarPorCodigosVendedoresPermitidos(ciudadesRaw);

            if (!ciudadesPermitidas.length) {
              this.tableData = [];
              this.chartData = [];
              this.cdr.markForCheck();
              return;
            }

            const consolidado = ciudadesPermitidas
              .map((row: any) => {
                const ciudad = this.repararTextoCiudad(
                  row?.ciudad ?? row?.nomCiudad ?? row?.nombreCiudad ?? '',
                );
                const cuota =
                  Number(row?.cuotaCiudad ?? row?.cuotaCiudadTotal ?? row?.cuota ?? 0) || 0;
                const ventaAcum = Number(row?.ventaAcum ?? 0) || 0;
                const proyeccionVenta = Number(row?.proyeccionVenta ?? 0) || 0;

                return {
                  ciudad,
                  cuota,
                  ventaAcum,
                  proyeccionVenta,
                  porcCump:
                    Number(row?.porcCumpCiudad ?? row?.porcCump ?? 0) ||
                    (cuota > 0 ? (ventaAcum / cuota) * 100 : 0),
                  porcCumProy:
                    Number(row?.porcCumProyGlobal ?? row?.porcCumProy ?? 0) ||
                    (cuota > 0 ? (proyeccionVenta / cuota) * 100 : 0),
                };
              })
              .filter((item: any) => item?.ciudad && !this.esCiudadResumen(item?.ciudad));

            const filtrado = this.filtrarPorCiudadSeleccionada(consolidado);
            const ordenado = [...filtrado].sort((a: any, b: any) =>
              this.repararTextoCiudad(a?.ciudad).localeCompare(
                this.repararTextoCiudad(b?.ciudad),
                'es',
              ),
            );
            const topCiudades = [...filtrado]
              .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
              .slice(0, 15);

            this.tableData = ordenado;
            this.totalAcumuladoCiudad = ordenado.reduce(
              (sum: number, item: any) =>
                sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
              0,
            );
            this.totalTopCiudades = topCiudades.reduce(
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
              0,
            );
            this.chartData = topCiudades.map((i: any) => ({
              name: this.repararTextoCiudad(i?.ciudad),
              value: Number(i?.ventaAcum ?? 0),
            }));
            this.chartId = 'chart-ciudad-admin-' + Date.now();
            this.emitirResumenVista();
            this.cdr.markForCheck();
          });
        return;

      case 'item':
      case 'cliente':
        this.chartType = 'bar';

        if (this.activeVentasView === 'cliente') {
          this.cargarDetalleClientesAdministrador(filtrosConsulta);
          return;
        }

        // El endpoint /items-vendidos determina el alcance por token:
        // admin -> todos los items, supervisor -> su equipo, vendedor -> los suyos.
        this.resetearPaginacionItemsVendidos();
        this.cargandoMasItemsVendidos = true;
        this.cdr.markForCheck();

        this.cumplimientoService
          .getProductosPorVendedor('', filtrosConsulta, {
            page: this.itemsVendidosPageActual,
            limit: this.itemsVendidosPorPagina,
          })
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe({
            next: (res: any) => {
              const listado = Array.isArray(res?.data) ? res.data : [];
              this.itemsVendidosPaginacion = res?.paginacion ?? null;
              const listadoOrdenado = this.ordenarDetalleItemsPorFechaAsc(listado);
              this.allItemData = listadoOrdenado;
              this.tableData = [...listadoOrdenado];
              this.cargandoMasItemsVendidos = false;
              this.recalcularChart();
            },
            error: () => {
              this.allItemData = [];
              this.tableData = [];
              this.cargandoMasItemsVendidos = false;
              this.cdr.markForCheck();
            },
          });
        return;

      default:
        if (this._tipoCuota === 'diaria') {
          this.cargarVistaAdminCuotaDiaria(filtrosConsulta);
          return;
        }

        admin$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
          const detalle = this.filtrarPorCodigosVendedoresPermitidos(
            this.mapearDetalleAdminAVendedores(res?.detalle ?? []),
          );

          switch (this.activeVentasView) {
            case 'ventas':
            case 'vendedor': {
              this.chartType = this.activeVentasView === 'ventas' ? 'line' : 'bar';

              // Aplicar filtro de vendedor si está seleccionado
              const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
              const vendedoresFiltrados = codigoVendedorFiltro
                ? this.filtrarVendedores(detalle, codigoVendedorFiltro)
                : detalle;

              this.tableData = vendedoresFiltrados;
              const venta = vendedoresFiltrados.reduce(
                (s: number, r: any) => s + (Number(r?.ventaAcum ?? 0) || 0),
                0,
              );
              const cuota = vendedoresFiltrados.reduce(
                (s: number, r: any) => s + (Number(r?.[this.cuotaColumn] ?? 0) || 0),
                0,
              );
              const proyeccion = vendedoresFiltrados.reduce(
                (s: number, r: any) => s + (Number(r?.proyeccionVenta ?? 0) || 0),
                0,
              );

              if (this.activeVentasView === 'ventas') {
                this.chartData = [
                  { name: 'Venta', value: venta },
                  { name: 'Cuota', value: cuota },
                  { name: 'Proyección', value: proyeccion },
                ];
              } else {
                this.pintarVistaVendedor(
                  vendedoresFiltrados,
                  filtrosConsulta,
                  'chart-vendedor-admin',
                );
                return;
              }
              break;
            }

            case 'proveedor': {
              this.chartType = 'bar';
              const agrupado = this.agruparAdminPorCampo(detalle, 'linea', 'linea');

              // Aplicar filtro de proveedor si está seleccionado
              const codigoProveedorFiltro = String(filtrosConsulta.proveedor ?? '').trim();
              const proveedoresFiltrados = codigoProveedorFiltro
                ? this.filtrarProveedores(agrupado, codigoProveedorFiltro)
                : agrupado;

              const ordenado = this.ordenarProveedoresPorAlfabeto(proveedoresFiltrados);
              const topProveedores = [...proveedoresFiltrados]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 12);

              this.totalTopProveedores = topProveedores.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.liderVentasProveedor = this.nombreProveedorCard(topProveedores[0]?.linea ?? '—');
              this.tableData = ordenado;
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
                value: i.ventaAcum,
              }));
              break;
            }

            case 'ciudad': {
              this.chartType = 'pie';
              const agrupado = this.agruparAdminPorCampo(detalle, 'ciudad', 'ciudad').map(
                (r: any) => ({
                  ...r,
                  ciudad: this.repararTextoCiudad(r?.ciudad),
                }),
              );
              const filtrado = this.filtrarPorCiudadSeleccionada(agrupado);
              const ordenado = [...filtrado].sort((a: any, b: any) =>
                this.repararTextoCiudad(a?.ciudad).localeCompare(
                  this.repararTextoCiudad(b?.ciudad),
                  'es',
                ),
              );
              const topCiudades = [...filtrado]
                .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
                .slice(0, 15);

              this.tableData = ordenado;
              this.totalAcumuladoCiudad = ordenado.reduce(
                (sum: number, item: any) =>
                  sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
                0,
              );
              this.totalTopCiudades = topCiudades.reduce(
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
                0,
              );
              this.chartData = topCiudades.map((i: any) => ({
                name: this.repararTextoCiudad(i.ciudad),
                value: i.ventaAcum,
              }));
              this.emitirResumenVista();
              break;
            }
          }

          this.cdr.markForCheck();
        });
    }
  }

  // ─── CUOTA DIARIA ADMIN ──────────────────────────────────────────────────────────────

  protected cargarVistaAdminCuotaDiaria(filtrosConsulta: DashboardFilters): void {
    const fechaInicio = String(filtrosConsulta.fechaInicio ?? '').trim();
    const fechaFin = String(filtrosConsulta.fechaFin ?? '').trim();

    console.debug('[Admin CuotaDiaria] Fechas:', { fechaInicio, fechaFin });

    if (!fechaInicio || !fechaFin) {
      console.warn('[Admin CuotaDiaria] Fechas vacías, no se cargan datos');
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaAdmin({ fechaInicio, fechaFin })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((cuotas: any[]) => {
        console.debug('[Admin CuotaDiaria] Respuesta del endpoint:', {
          totalRegistros: cuotas?.length ?? 0,
          primerRegistro: cuotas?.[0] ?? null,
        });

        this.cuotasDiariasCache = cuotas;

        if (!cuotas.length) {
          console.warn('[Admin CuotaDiaria] Endpoint retornó 0 registros');
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotasMapeadas = this.mapearCuotaDiariaData(cuotas);
        console.debug('[Admin CuotaDiaria] Datos mapeados:', { total: cuotasMapeadas.length });

        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);
        console.debug('[Admin CuotaDiaria] Datos después de filtrar:', {
          total: cuotasFiltradas.length,
          tieneCodigosPermitidos: this.tieneCodigosVendedoresPermitidos(),
        });

        switch (this.activeVentasView) {
          case 'ventas': {
            this.chartType = 'line';

            const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
            const vendedoresFiltrados = codigoVendedorFiltro
              ? this.filtrarVendedores(cuotasFiltradas, codigoVendedorFiltro)
              : cuotasFiltradas;

            this.tableData = vendedoresFiltrados;
            console.debug('[Admin CuotaDiaria] tableData final:', this.tableData.length);

            this.totalCuotaDiaria = vendedoresFiltrados.reduce(
              (sum: number, item: any) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
              0,
            );

            this.chartData = [
              { name: 'Cuota Diaria', value: this.totalCuotaDiaria },
              {
                name: 'Venta Acumulada',
                value: vendedoresFiltrados.reduce(
                  (s: number, i: any) => s + (Number(i.ventaAcum ?? 0) || 0),
                  0,
                ),
              },
              {
                name: 'Proyección',
                value: vendedoresFiltrados.reduce(
                  (s: number, i: any) => s + (Number(i.proyeccionVenta ?? 0) || 0),
                  0,
                ),
              },
            ];
            break;
          }

          case 'vendedor': {
            this.chartType = 'bar';

            const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
            const vendedoresFiltrados = codigoVendedorFiltro
              ? this.filtrarVendedores(cuotasFiltradas, codigoVendedorFiltro)
              : cuotasFiltradas;

            this.tableData = [...vendedoresFiltrados].sort((a: any, b: any) => {
              const codigoA = this.normalizarCodigoVendedor(a?.codVendedor ?? '');
              const codigoB = this.normalizarCodigoVendedor(b?.codVendedor ?? '');
              return codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
            });
            console.debug('[Admin CuotaDiaria] tableData vendedor:', this.tableData.length);

            this.totalCuotaDiaria = vendedoresFiltrados.reduce(
              (sum: number, item: any) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
              0,
            );

            this.totalCuotaVendedor = this.totalCuotaDiaria;
            this.totalAcumuladoVendedor = vendedoresFiltrados.reduce(
              (sum: number, item: any) => sum + (Number(item.ventaAcum ?? 0) || 0),
              0,
            );

            const topVendedores = [...vendedoresFiltrados]
              .sort((a: any, b: any) => Number(b.ventaAcum ?? 0) - Number(a.ventaAcum ?? 0))
              .slice(0, 15);

            this.totalTopVendedores = topVendedores.reduce(
              (sum: number, item: any) => sum + (Number(item.ventaAcum ?? 0) || 0),
              0,
            );

            this.chartData = topVendedores.map((item: any) => ({
              name: item.nombre ?? item.codVendedor,
              value: Number(item.ventaAcum ?? 0),
            }));

            this.chartId = `chart-vendedor-admin-${Date.now()}`;
            break;
          }

          case 'proveedor':
          case 'ciudad':
          case 'categoria':
          case 'item':
          case 'cliente':
            this.tableData = [];
            this.chartData = [];
            break;
        }

        this.cdr.markForCheck();
      });
  }

  protected mapearCuotaDiariaData(cuotas: any[]): any[] {
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

  /**
   * Si `filtrosConsulta.vendedor` está definido, filtra la lista de códigos
   * de vendedor para que la iteración per-vendor (Por Proveedor / Por Categoría
   * / Por Ciudad) SOLO consulte el vendor seleccionado, en lugar de consolidar
   * los datos de todos los vendors del catálogo.
   *
   * Si NO hay filtro de vendor, retorna la lista original sin tocarla.
   */
  protected filtrarCodigosPorFiltroVendedor(
    codigos: string[],
    filtros: DashboardFilters,
  ): string[] {
    const vendedorFiltro = String(filtros?.vendedor ?? '').trim();
    if (!vendedorFiltro) return codigos;

    // Aceptar "20" cuando la lista tiene "020" y viceversa.
    const candidatos = new Set<string>([vendedorFiltro]);
    const numerico = vendedorFiltro.replace(/\D/g, '');
    if (numerico) {
      candidatos.add(numerico);
      candidatos.add(String(Number(numerico)));
      candidatos.add(numerico.padStart(4, '0'));
    }
    const objetivo = this.normalizarCodigoVendedor(vendedorFiltro);

    return (codigos ?? []).filter((c) => {
      if (!c) return false;
      if (candidatos.has(c)) return true;
      return this.normalizarCodigoVendedor(c) === objetivo;
    });
  }
}
//recueperar archivo original en caso de error: src/app/features/dashboard/components/ventas/roles/administrador/ventas-administrador-base.ts
