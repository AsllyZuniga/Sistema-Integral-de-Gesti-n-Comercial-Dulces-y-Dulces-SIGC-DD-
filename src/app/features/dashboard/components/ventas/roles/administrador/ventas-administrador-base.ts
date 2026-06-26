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
        // Issue #1: usar el endpoint único role-aware. El backend filtra
        // por scope según el JWT: admin ve todo, supervisor ve su equipo,
        // vendedor ve solo lo suyo. Ya no hace falta N+1 ni fallback.
        this.cumplimientoService
          .getCuotaCategoriaGeneral(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            // Issue #1 (front): el endpoint /cuota-categoria/general ya filtra
            // por scope JWT (admin todo, supervisor equipo, vendedor propio).
            // NO aplicar filtrarPorCodigosVendedoresPermitidos aquí porque
            // el detalle NO trae codVendedor por fila → la función filtra
            // todo y deja la tabla vacía para el supervisor. Solo el caso
            // legacy de admin "default" (cumplimientoMesAdmin) lo requiere.
            const detallePermitido = Array.isArray(res?.detalle) ? res.detalle : [];
            const categoriasSeleccionadas =
              Array.isArray(filtrosConsulta.categorias) && filtrosConsulta.categorias.length
                ? filtrosConsulta.categorias.filter(Boolean)
                : Array.isArray(filtrosConsulta.categoriaNombres)
                  ? filtrosConsulta.categoriaNombres.filter(Boolean)
                  : [];
            const categoriaFiltro = categoriasSeleccionadas.length
              ? categoriasSeleccionadas
              : filtrosConsulta.categoria;

            const detalleFiltrado = this.filtrarCategoriasReales(detallePermitido, categoriaFiltro);
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

      case 'proveedor': {
        this.chartType = 'bar';
        // Issue #2: 1 sola llamada al endpoint role-aware (mes o semana).
        // El backend filtra por scope JWT: admin ve todo, supervisor ve su
        // equipo, vendedor ve solo lo suyo. Se eliminó la N+1 que antes
        // iteraba per-vendor y no mostraba datos al supervisor.
        const lineas$ = this.esSemanal
          ? this.semanaService.getLineasAdmin(filtrosConsulta)
          : this.cumplimientoService.getLineasAdmin(filtrosConsulta);

        lineas$
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            // Issue #2 (front): el endpoint /mes/cumplimiento/lineas ya filtra
            // por scope JWT. NO aplicar filtrarPorCodigosVendedoresPermitidos
            // aquí porque el detallePorLinea NO trae codVendedor por fila →
            // la función filtra todo y deja la tabla vacía para el supervisor.
            const lineas = Array.isArray(res?.detallePorLinea) ? res.detallePorLinea : [];
            const lineasPermitidas = lineas;

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
      }

      case 'ciudad': {
        this.chartType = 'pie';
        // Microtarea B5: 1 sola llamada al endpoint role-aware /ciudades-global.
        // El backend filtra por scope JWT: admin ve todo, supervisor ve su
        // equipo, vendedor ve solo lo suyo. Se eliminó la N+1 que iteraba
        // per-vendor con combinarResultadosPorVendedor.
        const ciudades$ = this.esSemanal
          ? this.semanaService.getCiudadesGlobal(filtrosConsulta)
          : this.cumplimientoService.getCiudadesGlobal(filtrosConsulta);

        ciudades$
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            // Microtarea B5 (front): el endpoint /ciudades-global ya filtra
            // por scope JWT. NO aplicar filtrarPorCodigosVendedoresPermitidos
            // aquí porque el detallePorCiudad NO trae codVendedor por fila.
            const ciudadesRaw = Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
            const ciudadesPermitidas = ciudadesRaw;

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
      }

      case 'item':
      case 'cliente':
        this.chartType = 'bar';

        if (this.activeVentasView === 'cliente') {
          this.cargarDetalleClientesAdministrador(filtrosConsulta);
          return;
        }

        // Issue #3: 1 sola llamada al endpoint role-aware /api/items-vendidos.
        // El backend filtra por scope JWT: admin ve todo, supervisor ve su
        // equipo, vendedor ve solo lo suyo. Se eliminó la N+1 que hacía
        // forkJoin de N llamadas a /vendedor/:cod/productos.
        this.cumplimientoService
          .getItemsVendidos(filtrosConsulta)
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe((res: any) => {
            // Issue #3 (front): el backend /api/items-vendidos responde
            // { success, data: { rows: [...], paginado } } (no data como
            // array). Soportar ambos shapes por compatibilidad.
            const data = res?.data;
            const listado = Array.isArray(data)
              ? data
              : Array.isArray(data?.rows)
                ? data.rows
                : [];
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

              // Aplicar filtro de vendedor (soporta array multi o string legacy)
              const codigosVendedorFiltro = this.normalizarValoresFiltro(filtrosConsulta.vendedores, filtrosConsulta.vendedor);
              const vendedoresFiltrados = codigosVendedorFiltro.length
                ? this.filtrarVendedoresMulti(detalle, codigosVendedorFiltro)
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

              // Aplicar filtro de proveedor (array multi o string legacy)
              const codigosProveedorFiltro = this.normalizarValoresFiltro(filtrosConsulta.proveedores, filtrosConsulta.proveedor);
              const proveedoresFiltrados = codigosProveedorFiltro.length
                ? this.filtrarProveedoresMulti(agrupado, codigosProveedorFiltro)
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
}
//recueperar archivo original en caso de error: src/app/features/dashboard/components/ventas/roles/administrador/ventas-administrador-base.ts
