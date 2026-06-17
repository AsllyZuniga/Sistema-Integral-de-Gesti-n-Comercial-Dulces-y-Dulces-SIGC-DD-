import { Directive } from '@angular/core';
import { forkJoin, merge, takeUntil } from 'rxjs';
import { DashboardFilters } from '../../../../../../shared/components/filters/filters.component';
import { VentasUtilidadesBase } from '../../services/ventas-utilidades-base';

@Directive()
export abstract class VentasAdministradorBase extends VentasUtilidadesBase {

  protected cargarVistaAdminTodos(filtrosConsulta: DashboardFilters): void {
    const filtrosAdmin =
      this.activeVentasView === 'ciudad' ? { ...filtrosConsulta, vendedor: '' } : filtrosConsulta;

    const admin$ = this.esSemanal
      ? this.semanaService.getCumplimientoSemanaAdmin(filtrosAdmin)
      : this.cumplimientoService.getCumplimientoMesAdmin(filtrosAdmin);

    switch (this.activeVentasView) {
      case 'categoria':
        this.chartType = 'bar';
        if (this.tieneCodigosVendedoresPermitidos()) {
          const codigos = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);

          if (!codigos.length) {
            this.tableData = [];
            this.chartData = [];
            this.cdr.markForCheck();
            return;
          }

          const filtrosParaConsulta =
            Array.isArray(filtrosConsulta.categorias) && filtrosConsulta.categorias.length > 1
              ? {
                  ...filtrosConsulta,
                  categoria: '',
                  categoriaNombre: '',
                  categorias: [],
                  categoriaNombres: [],
                }
              : filtrosConsulta;

          this.combinarResultadosPorVendedor(
            codigos,
            (codigo) =>
              this.esSemanal
                ? this.semanaService.getCuotaCategoriaPorVendedor(codigo, filtrosParaConsulta)
                : this.cumplimientoService.getCuotaCategoriaPorVendedor(codigo, filtrosParaConsulta),
            (res) => (Array.isArray(res?.detalle) ? res.detalle : []),
          )
            .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
            .subscribe((detalleBruto: any[]) => {
              const categoriasSeleccionadas = Array.isArray(filtrosConsulta.categorias)
                && filtrosConsulta.categorias.length
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
          .getCuotaCategoriaGeneral(
            Array.isArray(filtrosConsulta.categorias) && filtrosConsulta.categorias.length > 1
              ? {
                  ...filtrosConsulta,
                  categoria: '',
                  categoriaNombre: '',
                  categorias: [],
                  categoriaNombres: [],
                }
              : filtrosConsulta,
          )
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            const pintarCategoria = (detalleRaw: any[]) => {
              const detallePermitido = this.filtrarPorCodigosVendedoresPermitidos(detalleRaw);
              const categoriasSeleccionadas = Array.isArray(filtrosConsulta.categorias)
                && filtrosConsulta.categorias.length
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
          const codigos = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);

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
          const codigos = this.filtrarCodigosPermitidos(this._codigosVendedoresPermitidos);

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
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
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
              (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
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

        this.cumplimientoService
          .getVendedores()
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((vendedores: any[]) => {
            const codigos = this.filtrarCodigosPermitidos(
              (Array.isArray(vendedores) ? vendedores : [])
                .map((v: any) =>
                  String(v?.codigo_vendedor ?? v?.codVendedor ?? v?.codigo ?? '').trim(),
                )
                .filter(Boolean),
            );

            if (!codigos.length) {
              this.tableData = [];
              this.chartData = [];
              this.cdr.markForCheck();
              return;
            }

            const calls = codigos.map((codigo) =>
              this.cumplimientoService.getProductosPorVendedor(codigo, filtrosConsulta),
            );

            forkJoin(calls)
              .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
              .subscribe((responses: any[]) => {
                const listado = responses.flatMap((r: any) =>
                  Array.isArray(r?.data) ? r.data : [],
                );
                const listadoOrdenado = this.ordenarDetalleItemsPorFechaAsc(listado);
                this.allItemData = listadoOrdenado;
                this.tableData = [...listadoOrdenado];
                this.recalcularChart();
              });
          });
        return;

      default:
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
                (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0),
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
}
