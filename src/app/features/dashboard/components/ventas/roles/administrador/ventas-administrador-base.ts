import { Directive } from '@angular/core';
import { forkJoin, merge, takeUntil, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DashboardFilters } from '../../../../../../shared/components/filters/filters.component';
import { VentasUtilidadesBase } from '../../services/ventas-utilidades-base';

@Directive()
export abstract class VentasAdministradorBase extends VentasUtilidadesBase {
  protected cargarVistaAdminTodos(filtrosConsulta: DashboardFilters): void {
    // Mantener siempre el filtro de vendedor cuando venga seleccionado.
    // ADMINISTRADOR y SUPERVISOR pueden filtrar por vendedor; VENDEDOR no recibe
    // este filtro desde la UI y el backend restringe por token.
    const filtrosAdmin = filtrosConsulta;

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
            const categoriasSeleccionadas = this.normalizarValoresFiltro(
              filtrosConsulta.categorias && filtrosConsulta.categorias.length
                ? filtrosConsulta.categorias
                : filtrosConsulta.categoriaNombres,
              null,
            );
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

            if (this.totalCuotaCategoria > 0) {
              this.emitirResumenVista();
            } else {
              // Categoría sin cuota propia (0 exacto): la card debe caer al
              // fallback de cuota del vendedor filtrado, que puede no estar
              // disponible aún si el usuario no visitó la pestaña Vendedor.
              // soloCuota=true: la venta acumulada de Categoría ya se
              // calculó arriba (totalAcumuladoCategoria).
              this.refrescarCuotaVendedorFiltrado(filtrosConsulta, true);
            }
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

            const detalleMapeado = lineasPermitidas.map((item: any) => {
              const proveedorVisible =
                item?.reporteProvConObs ??
                item?.reporte_prov_con_obs ??
                item?.linea ??
                item?.codigoLinea ??
                item?.codigo_linea ??
                item?.proveedor ??
                item?.nombreProveedor ??
                item?.nombre_proveedor ??
                'Sin proveedor';

              return {
                ...item,
                linea: proveedorVisible,
                reporteProvConObs: item?.reporteProvConObs ?? item?.reporte_prov_con_obs ?? proveedorVisible,
                proveedor: item?.proveedor ?? proveedorVisible,
                cuotaLinea:
                  Number(item?.cuotaProveedorTotal ?? item?.cuotaProveedor ?? item?.cuotaLinea ?? 0) || 0,
                ventaAcum: Number(item?.ventaAcum ?? item?.acumulado ?? 0) || 0,
                porcCump: Number(item?.porcCump ?? item?.cumplimiento ?? 0) || 0,
                proyeccionVenta: Number(item?.proyeccionVenta ?? item?.proyeccion ?? 0) || 0,
                porcCumProy: Number(item?.porcCumProy ?? item?.cumplimientoProyeccion ?? 0) || 0,
              };
            });

            // Refuerzo front: si el backend devuelve todos los proveedores aunque
            // se haya enviado proveedor/proveedores, la tabla debe mostrar solo los
            // proveedores seleccionados. El match es flexible: "535 - ABBOTT"
            // coincide con filas que lleguen como "535" o solo "ABBOTT".
            const proveedoresSeleccionados = this.normalizarValoresFiltro(
              filtrosConsulta.proveedores,
              filtrosConsulta.proveedor,
            );
            const detalleFiltradoPorProveedor = proveedoresSeleccionados.length
              ? this.filtrarProveedoresMulti(detalleMapeado, proveedoresSeleccionados)
              : detalleMapeado;

            // Fusionar filas del mismo proveedor que llegaron con distinto
            // código de reporte ("535 - ABBOTT" / "536 - ABBOTT") y quitar
            // el código antepuesto del nombre mostrado.
            const detalleConsolidado = this.consolidarPorLinea(detalleFiltradoPorProveedor);

            const ordenado = this.ordenarProveedoresPorAlfabeto(detalleConsolidado);

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

            if (this.totalCuotaProveedor > 0) {
              this.emitirResumenVista();
            } else {
              // Proveedor sin cuota propia (0 exacto): la card debe caer al
              // fallback de cuota del vendedor filtrado, que puede no estar
              // disponible aún si el usuario no visitó la pestaña Vendedor.
              // soloCuota=true: la venta acumulada de Proveedor ya se
              // calculó arriba (totalAcumuladoProveedor).
              this.refrescarCuotaVendedorFiltrado(filtrosConsulta, true);
            }
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
        const ciudadesSeleccionadas = this.normalizarValoresFiltro(
          filtrosConsulta.ciudades,
          filtrosConsulta.ciudad,
        );

        // Refuerzo para multi-ciudad: algunos backends/queries de ciudades-global
        // toman solo la primera ciudad cuando llega ciudad=71,72. Para garantizar
        // que la tabla muestre TODAS las ciudades seleccionadas, cuando hay más de
        // una ciudad se consulta una vez por ciudad y luego se consolida en front.
        const ciudades$ = ciudadesSeleccionadas.length > 1
          ? forkJoin(
              ciudadesSeleccionadas.map((codigoCiudad) => {
                const filtrosCiudad: DashboardFilters = {
                  ...filtrosConsulta,
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
            ? this.semanaService.getCiudadesGlobal(filtrosConsulta)
            : this.cumplimientoService.getCiudadesGlobal(filtrosConsulta);

        forkJoin({
          res: ciudades$,
          cuotaTotalVendedores: this.calcularCuotaTotalVendedores$(filtrosConsulta),
        })
          .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
          .subscribe(({ res, cuotaTotalVendedores }: any) => {
            // Microtarea B5 (front): el endpoint /ciudades-global ya filtra
            // por scope JWT. NO aplicar filtrarPorCodigosVendedoresPermitidos
            // aquí porque el detallePorCiudad NO trae codVendedor por fila.
            const ciudadesRaw = Array.isArray(res)
              ? res.flatMap((item: any) => Array.isArray(item?.detallePorCiudad) ? item.detallePorCiudad : [])
              : Array.isArray(res?.detallePorCiudad) ? res.detallePorCiudad : [];
            const ciudadesPermitidas = ciudadesRaw;

            if (!ciudadesPermitidas.length) {
              this.tableData = [];
              this.chartData = [];
              this.cdr.markForCheck();
              return;
            }

            // El "Cumpl. %"/"Cumpl. Proy. %" de cada ciudad representa qué
            // parte de la cuota total del/los vendedor(es) filtrado(s) se
            // vendió/proyecta en esa ciudad (Ciudad no tiene cuota propia).
            const cuotaTotal = Number(cuotaTotalVendedores ?? 0) || 0;

            const consolidado = ciudadesPermitidas
              .map((row: any) => {
                const ciudad = this.repararTextoCiudad(
                  row?.ciudad ?? row?.nomCiudad ?? row?.nombreCiudad ?? '',
                );
                const cuota =
                  Number(row?.cuotaCiudad ?? row?.cuotaCiudadTotal ?? row?.cuota ?? 0) || 0;
                const ventaAcum = Number(row?.ventaAcum ?? row?.venta ?? 0) || 0;
                const proyeccionVenta = Number(row?.proyeccionVenta ?? 0) || 0;

                const idCiudad = String(
                  row?.id_ciudad ??
                    row?.idCiudad ??
                    row?.codCiudad ??
                    row?.codigoCiudad ??
                    row?.codigo ??
                    row?.cod ??
                    '',
                ).trim();

                return {
                  ...row,
                  id_ciudad: idCiudad,
                  ciudad,
                  cuota,
                  ventaAcum,
                  proyeccionVenta,
                  porcCump: cuotaTotal > 0 ? (ventaAcum / cuotaTotal) * 100 : 0,
                  porcCumProy: cuotaTotal > 0 ? (proyeccionVenta / cuotaTotal) * 100 : 0,
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
            // Ciudad no tiene cuota propia: la card debe mostrar la cuota
            // del/los vendedor(es) filtrado(s). soloCuota=true porque la
            // venta acumulada de Ciudad ya se calculó arriba
            // (totalAcumuladoCiudad).
            this.refrescarCuotaVendedorFiltrado(filtrosConsulta, true);
            this.cdr.markForCheck();
          });
        return;
      }

      case 'item':
      case 'cliente':
        this.chartType = 'bar';

        if (this.activeVentasView === 'cliente') {
          this.cargarDetalleClientesAdministrador(filtrosConsulta);
          // Cliente no tiene cuota propia: la card debe mostrar la cuota
          // del/los vendedor(es) filtrado(s). soloCuota=true porque la
          // venta acumulada de esta vista ya la calcula
          // cargarDetalleClientesAdministrador con su propio total.
          this.refrescarCuotaVendedorFiltrado(filtrosConsulta, true);
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
            // Item no tiene cuota propia: la card debe mostrar la cuota
            // del/los vendedor(es) filtrado(s).
            this.refrescarCuotaVendedorFiltrado(filtrosConsulta);
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

              this.tableData = [...vendedoresFiltrados].sort((a: any, b: any) => {
                const codigoA = this.normalizarCodigoVendedor(a?.codVendedor ?? '');
                const codigoB = this.normalizarCodigoVendedor(b?.codVendedor ?? '');
                return codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
              });
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
          }

          this.cdr.markForCheck();
        });
    }
  }

  // ─── CUOTA DIARIA ADMIN ──────────────────────────────────────────────────────────────

  /**
   * Helper: extrae el valor numérico de la cuota diaria desde un campo que
   * puede llegar como `number` plano o como objeto `{ cuota_dia: N }`
   * (shape que entrega `/dia/cumplimiento/front` para cuotaDia/cuotaDiaria).
   */
  private leerCuotaDiariaNumero(valor: any): number {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
    if (valor && typeof valor === 'object') {
      return Number(valor.cuota_dia ?? valor.cuota_mes ?? valor.cuota_semana ?? 0) || 0;
    }
    return Number(valor ?? 0) || 0;
  }

  /**
   * FIX: repara nombres de proveedores que llegan con el carácter de
   * reemplazo Unicode (U+FFFD) por mal encoding del backend
   * (típicamente Windows-1252/UTF-8 mojibake). El backend entrega
   * p.ej. "OCA\uFFFDA" cuando debería ser "OCAÑA". La regla usada
   * en el resto del proyecto (`normalizarTextoFiltro`) solo ELIMINA
   * el U+FFFD, perdiendo la letra Ñ. Aquí lo re-mapeamos a Ñ.
   */
  private repararNombreVendedorEncoding(nombre: unknown): string {
    let txt = String(nombre ?? '').trim();
    if (!txt) return '';
    // Caso típico: \uFFFD antes de A, E, I, O, U, S, Z, etc. → restaurar Ñ.
    // (U+FFFD antes de cualquier letra = la letra Ñ mal decodificada.)
    txt = txt.replace(/\uFFFD(?=[A-Za-zÁÉÍÓÚáéíóúÑñ])/g, 'Ñ');
    // También eliminar U+FFFD sueltos (no seguidos de letra) por si acaso.
    txt = txt.replace(/\uFFFD/g, '');
    return txt;
  }

  /**
   * Mapea el detalle de `/dia/cumplimiento/front` (shape de cumplimiento
   * que ya alimenta las cards) al shape interno de cuota diaria usado por
   * la tabla y los charts. Esto garantiza que la card "Venta Diaria" y
   * el total acumulado de la tabla coincidan exactamente.
   */
  protected mapearCuotaDiariaDataDesdeCumplimiento(filas: any[]): any[] {
    if (!Array.isArray(filas)) return [];
    return filas
      .filter((fila) => fila != null)
      .map((fila: any) => ({
        codVendedor: String(
          fila?.codigo_vendedor ?? fila?.codVendedor ?? fila?.codigoVendedor ?? fila?.cod ?? '',
        ).trim(),
        nombre: this.repararNombreVendedorEncoding(
          fila?.nombre ?? fila?.nom_vendedor ?? '',
        ),
        cuotaDiaria: this.leerCuotaDiariaNumero(fila?.cuotaDiaria ?? fila?.cuotaDia),
        ventaAcum:
          Number(
            fila?.ventaAcum ?? fila?.ventaDiaria ?? fila?.venta_acumulada_dia ?? 0,
          ) || 0,
        porcCump: Number(fila?.porcCump ?? fila?.cumplimiento ?? fila?.pct_cumplimiento ?? 0) || 0,
        proyeccionVenta:
          Number(
            fila?.proyeccionVenta ??
              fila?.proyeccion ??
              fila?.proye_venta ??
              fila?.promedioDiario ??
              0,
          ) || 0,
        porcCumProy:
          Number(
            fila?.porcCumProy ??
              fila?.cumplimientoProyectado ??
              fila?.pct_cumplimiento ??
              fila?.porcCump ??
              0,
          ) || 0,
      }));
  }

  /**
   * FIX: deduplica el detalle de `/dia/cumplimiento/front` por código de
   * vendedor. El endpoint puede devolver varias filas para el mismo
   * vendedor (ej. "0001" con datos y "1" con ceros) y solo nos interesa
   * la fila con datos reales. Misma lógica que
   * `AdministradorComponent.normalizarDetalleCuotaDiaria`.
   */
  private puntajeFilaCuotaDiaria(fila: any): number {
    if (!fila) return 0;
    return [
      this.leerCuotaDiariaNumero(fila?.cuotaDiaria ?? fila?.cuotaDia),
      Number(fila?.ventaAcum ?? fila?.ventaDiaria ?? fila?.venta_acumulada_dia ?? 0) || 0,
      Number(fila?.porcCump ?? fila?.cumplimiento ?? 0) || 0,
      Number(
        fila?.proyeccionVenta ?? fila?.proyeccion ?? fila?.proye_venta ?? 0,
      ) || 0,
    ].reduce((suma, valor) => suma + Math.abs(valor), 0);
  }

  private esMejorFilaCuotaDiaria(candidata: any, actual: any): boolean {
    if (!actual) return true;
    const puntajeCandidata = this.puntajeFilaCuotaDiaria(candidata);
    const puntajeActual = this.puntajeFilaCuotaDiaria(actual);
    if (puntajeCandidata !== puntajeActual) return puntajeCandidata > puntajeActual;
    const ventaCandidata =
      Number(candidata?.ventaAcum ?? candidata?.ventaDiaria ?? 0) || 0;
    const ventaActual = Number(actual?.ventaAcum ?? actual?.ventaDiaria ?? 0) || 0;
    if (ventaCandidata !== ventaActual) return ventaCandidata > ventaActual;
    const cuotaCandidata = this.leerCuotaDiariaNumero(
      candidata?.cuotaDiaria ?? candidata?.cuotaDia,
    );
    const cuotaActual = this.leerCuotaDiariaNumero(actual?.cuotaDiaria ?? actual?.cuotaDia);
    return cuotaCandidata > cuotaActual;
  }

  /**
   * Genera todas las variantes de un código de vendedor (con/sin ceros)
   * para que el match funcione tanto para "0001" como para "1".
   */
  private generarClavesCodigoVendedor(codigoRaw: unknown): string[] {
    const codigo = String(codigoRaw ?? '').trim();
    if (!codigo) return [];
    const claves = new Set<string>([codigo]);
    const numerico = codigo.replace(/\D/g, '');
    if (numerico) {
      claves.add(numerico);
      claves.add(String(Number(numerico)));
      claves.add(numerico.padStart(4, '0'));
      claves.add(numerico.replace(/^0+/, '') || numerico);
    }
    return Array.from(claves).filter(Boolean);
  }

  private dedupeCuotaDiariaPorCodigo(detalle: any[]): any[] {
    if (!Array.isArray(detalle)) return [];
    // clave normalizada (con padding "0001") → mejor fila vista.
    // Guardamos también la fila bajo sus otras variantes de clave para
    // que el lookup las encuentre; al final deduplicamos los values
    // para no devolver la misma fila N veces (una por cada key alias).
    const porCodigo = new Map<string, any>();

    detalle.forEach((fila) => {
      const codigo = String(
        fila?.codigo_vendedor ??
          fila?.codVendedor ??
          fila?.codigoVendedor ??
          fila?.codigo ??
          fila?.cod ??
          '',
      ).trim();

      // FIX: descartar filas sin código (ej. "—" / "SIN NOMBRE") y filas
      // marcadas como TOTALES que no se filtraron en el paso previo.
      if (!codigo || codigo === '—' || codigo === '-') return;

      const claves = this.generarClavesCodigoVendedor(codigo);

      // Buscar si alguna variante de este código ya está registrada.
      let conflicto: any = null;
      for (const clave of claves) {
        const encontrada = porCodigo.get(clave);
        if (encontrada) {
          conflicto = encontrada;
          break;
        }
      }

      if (this.esMejorFilaCuotaDiaria(fila, conflicto)) {
        // Guardar la fila bajo TODAS las variantes de clave para que
        // futuras filas con códigos equivalentes (ej. "1" vs "0001")
        // la encuentren en el lookup.
        for (const clave of claves) {
          porCodigo.set(clave, fila);
        }
      }
    });

    // Dedupe: como cada fila se guarda bajo N keys, el values() las
    // devuelve N veces. Filtramos por referencia.
    const valoresUnicos: any[] = [];
    const vistos = new Set<any>();
    for (const valor of porCodigo.values()) {
      if (!vistos.has(valor)) {
        vistos.add(valor);
        valoresUnicos.push(valor);
      }
    }

    return valoresUnicos;
  }

  /**
   * Procesa la respuesta cruda de `/dia/cumplimiento/front` (o
   * `/dia/cumplimiento/supervisor/:id`):
   * 1) quita la fila TOTALES,
   * 2) deduplica por código de vendedor (varios códigos para el mismo vendor),
   * 3) mapea al shape interno de cuota diaria.
   */
  protected mapearCuotaDiariaAdminDesdeCumplimiento(res: any): any[] {
    const detalleBruto = Array.isArray(res?.detalle) ? res.detalle : [];
    const detalleSinTotales = detalleBruto.filter(
      (v: any) =>
        String(v?.codVendedor ?? v?.codigo_vendedor ?? '').trim().toUpperCase() !== 'TOTALES' &&
        String(v?.nombre ?? v?.nom_vendedor ?? '').trim().toUpperCase() !== 'TOTALES',
    );
    const detalleDeduplicado = this.dedupeCuotaDiariaPorCodigo(detalleSinTotales);
    return this.mapearCuotaDiariaDataDesdeCumplimiento(detalleDeduplicado);
  }

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

    // FIX: usar el MISMO endpoint que las cards (cumplimientoService
    // /dia/cumplimiento/front) para que la card "Venta Diaria" y el
    // total acumulado de la tabla coincidan exactamente. Antes este
    // método llamaba a /api/cuota-dia/por-dia (cuotaDiaService) que
    // devolvía un cálculo distinto para la misma fecha.
    this.cumplimientoService
      .getCumplimientoDiaAdmin(filtrosConsulta)
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((res: any) => {
        const detalleBruto = Array.isArray(res?.detalle) ? res.detalle : [];
        const totalesApi = res?.totales ?? null;

        console.debug('[Admin CuotaDiaria] Respuesta del endpoint cumplimiento:', {
          totalRegistros: detalleBruto.length,
          totales: totalesApi,
        });

        // FIX: dedup + map en un solo paso (helper compartido con
        // supervisor y vendedor para mantener la misma lógica).
        const cuotasMapeadas = this.mapearCuotaDiariaAdminDesdeCumplimiento(res);
        console.debug('[Admin CuotaDiaria] Datos mapeados (post-dedup):', {
          total: cuotasMapeadas.length,
        });

        this.cuotasDiariasCache = cuotasMapeadas as any;

        if (!cuotasMapeadas.length) {
          console.warn('[Admin CuotaDiaria] Endpoint retornó 0 registros');
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.emitirResumenVista();
          this.cdr.markForCheck();
          return;
        }

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

            const ventaAcumFuenteUnica = this.obtenerVentaAcumUnificadaCuotaDiaria(
              vendedoresFiltrados,
              totalesApi,
            );

            this.totalAcumuladoVentas = ventaAcumFuenteUnica;

            this.chartData = [
              { name: 'Cuota Diaria', value: this.totalCuotaDiaria },
              { name: 'Venta Acumulada', value: ventaAcumFuenteUnica },
              {
                name: 'Proyección',
                value: this.obtenerProyeccionUnificadaCuotaDiaria(
                  vendedoresFiltrados,
                  totalesApi,
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

            // FIX: usar la misma fuente única que la card (totales.totalVenta
            // si existe, si no la suma de las filas) para que coincida.
            this.totalAcumuladoVendedor = this.obtenerVentaAcumUnificadaCuotaDiaria(
              vendedoresFiltrados,
              totalesApi,
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

        this.emitirResumenVista();
        this.cdr.markForCheck();
      });
  }

  /**
   * FIX: calcula la "Venta Acumulada" usando el mismo origen que la card
   * KPI del administrador. Prioriza `totales.totalVenta` /
   * `totales.ventaDiaria` del backend (que es lo que muestra la card) y
   * solo si no existe, usa la suma de las filas de la tabla. Esto
   * garantiza que card y chart sumen exactamente lo mismo.
   */
  protected obtenerVentaAcumUnificadaCuotaDiaria(filas: any[], totalesApi: any): number {
    const desdeTotales = Number(
      totalesApi?.totalVenta ?? totalesApi?.ventaDiaria ?? totalesApi?.ventaAcum ?? NaN,
    );
    if (Number.isFinite(desdeTotales) && desdeTotales > 0) return desdeTotales;
    return filas.reduce(
      (sum: number, item: any) => sum + (Number(item.ventaAcum ?? 0) || 0),
      0,
    );
  }

  protected obtenerProyeccionUnificadaCuotaDiaria(filas: any[], totalesApi: any): number {
    const desdeTotales = Number(
      totalesApi?.proyeccionVenta ??
        totalesApi?.promedioDiario ??
        totalesApi?.proyeccion ??
        NaN,
    );
    if (Number.isFinite(desdeTotales) && desdeTotales > 0) return desdeTotales;
    return filas.reduce(
      (sum: number, item: any) => sum + (Number(item.proyeccionVenta ?? 0) || 0),
      0,
    );
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
   * Calcula la cuota total del/los vendedor(es) que quedan tras aplicar los
   * filtros activos (proveedor, categoría, ciudad, rango de fechas), usando
   * la misma fuente y el mismo criterio de filtrado que
   * `refrescarCuotaVendedorFiltrado`. Se usa como denominador para el
   * "Cumpl. %"/"Cumpl. Proy. %" de la tabla por Ciudad, que no tiene cuota
   * propia por fila: el % de cada ciudad debe representar qué parte de la
   * cuota total del/los vendedor(es) filtrado(s) se vendió en esa ciudad.
   */
  protected calcularCuotaTotalVendedores$(filtrosConsulta: DashboardFilters): Observable<number> {
    if (this._tipoCuota === 'diaria') {
      return this.cumplimientoService.getCumplimientoDiaAdmin(filtrosConsulta).pipe(
        map((res: any) => {
          const cuotasMapeadas = this.mapearCuotaDiariaAdminDesdeCumplimiento(res);
          const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);
          const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
          const vendedoresFiltrados = codigoVendedorFiltro
            ? this.filtrarVendedores(cuotasFiltradas, codigoVendedorFiltro)
            : cuotasFiltradas;

          return vendedoresFiltrados.reduce(
            (sum: number, item: any) => sum + (Number(item?.cuotaDiaria ?? 0) || 0),
            0,
          );
        }),
      );
    }

    const admin$ = this.esSemanal
      ? this.semanaService.getCumplimientoSemanaAdmin(filtrosConsulta)
      : this.cumplimientoService.getCumplimientoMesAdmin(filtrosConsulta);

    return admin$.pipe(
      map((res: any) => {
        const detalle = this.filtrarPorCodigosVendedoresPermitidos(
          this.mapearDetalleAdminAVendedores(res?.detalle ?? []),
        );
        const codigosVendedorFiltro = this.normalizarValoresFiltro(
          filtrosConsulta.vendedores,
          filtrosConsulta.vendedor,
        );
        const vendedoresFiltrados = codigosVendedorFiltro.length
          ? this.filtrarVendedoresMulti(detalle, codigosVendedorFiltro)
          : detalle;

        return vendedoresFiltrados.reduce(
          (sum: number, item: any) => sum + (Number(item?.[this.cuotaColumn] ?? 0) || 0),
          0,
        );
      }),
    );
  }

  /**
   * Refresca `totalCuotaVendedor`/`totalAcumuladoVendedor` para las vistas
   * que no tienen cuota propia (Ciudad, Cliente, Item) y necesitan mostrar
   * en la card la cuota del/los vendedor(es) filtrado(s), sin depender de
   * que el usuario haya visitado antes la pestaña Vendedor. No toca
   * `tableData`/`chartData` de la vista actual: solo alimenta los totales
   * que consume `obtenerCuotaVistaActiva()`/`obtenerVentaAcumVistaActiva()`.
   */
  protected refrescarCuotaVendedorFiltrado(
    filtrosConsulta: DashboardFilters,
    soloCuota = false,
  ): void {
    const vistaAlSolicitar = this.activeVentasView;

    if (this._tipoCuota === 'diaria') {
      this.cumplimientoService
        .getCumplimientoDiaAdmin(filtrosConsulta)
        .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
        .subscribe((res: any) => {
          if (this.activeVentasView !== vistaAlSolicitar) return;

          const cuotasMapeadas = this.mapearCuotaDiariaAdminDesdeCumplimiento(res);
          const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);
          const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
          const vendedoresFiltrados = codigoVendedorFiltro
            ? this.filtrarVendedores(cuotasFiltradas, codigoVendedorFiltro)
            : cuotasFiltradas;

          this.totalCuotaVendedor = vendedoresFiltrados.reduce(
            (sum: number, item: any) => sum + (Number(item?.cuotaDiaria ?? 0) || 0),
            0,
          );
          // Para 'cliente' no se sobrescribe la venta acumulada: esa vista
          // ya calcula su propio total (agrupado por vendedor con items
          // comprados) que es más preciso que este endpoint de cumplimiento.
          if (!soloCuota) {
            this.totalAcumuladoVendedor = this.obtenerVentaAcumUnificadaCuotaDiaria(
              vendedoresFiltrados,
              res?.totales ?? null,
            );
          }

          this.emitirResumenVista();
        });
      return;
    }

    const admin$ = this.esSemanal
      ? this.semanaService.getCumplimientoSemanaAdmin(filtrosConsulta)
      : this.cumplimientoService.getCumplimientoMesAdmin(filtrosConsulta);

    admin$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe((res: any) => {
      if (this.activeVentasView !== vistaAlSolicitar) return;

      const detalle = this.filtrarPorCodigosVendedoresPermitidos(
        this.mapearDetalleAdminAVendedores(res?.detalle ?? []),
      );
      const codigosVendedorFiltro = this.normalizarValoresFiltro(
        filtrosConsulta.vendedores,
        filtrosConsulta.vendedor,
      );
      const vendedoresFiltrados = codigosVendedorFiltro.length
        ? this.filtrarVendedoresMulti(detalle, codigosVendedorFiltro)
        : detalle;

      this.totalCuotaVendedor = vendedoresFiltrados.reduce(
        (sum: number, item: any) => sum + (Number(item?.[this.cuotaColumn] ?? 0) || 0),
        0,
      );
      if (!soloCuota) {
        this.totalAcumuladoVendedor = vendedoresFiltrados.reduce(
          (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
          0,
        );
      }

      this.emitirResumenVista();
    });
  }
}
//recueperar archivo original en caso de error: src/app/features/dashboard/components/ventas/roles/administrador/ventas-administrador-base.ts
