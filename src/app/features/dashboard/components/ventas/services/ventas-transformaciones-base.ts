import { Directive } from '@angular/core';
import { RoleId } from '../../../../../core/auth/roles';
import { DashboardFilters } from '../../../../../shared/components/filters/filters.component';
import { VentasEstadoBase } from './ventas-estado-base';

@Directive()
export abstract class VentasTransformacionesBase extends VentasEstadoBase {

  protected abstract obtenerNombreCategoria(item: any): string;
  protected abstract repararTextoCiudad(valor: unknown): string;
  protected abstract esCiudadResumen(valor: unknown): boolean;
  protected abstract normalizarTexto(valor: unknown): string;
  protected abstract filtrarVendedores(listado: any[], codigoVendedor: string): any[];

  protected consolidarPorLinea(lineas: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const item of lineas) {
      const linea = String(item?.linea ?? '').trim();
      if (!linea) continue;

      const existente = mapa.get(linea);
      if (!existente) {
        mapa.set(linea, {
          ...item,
          cuotaLinea: Number(item?.cuotaLinea ?? 0),
          ventaAcum: Number(item?.ventaAcum ?? 0),
          proyeccionVenta: Number(item?.proyeccionVenta ?? 0),
        });
      } else {
        existente.cuotaLinea += Number(item?.cuotaLinea ?? 0);
        existente.ventaAcum += Number(item?.ventaAcum ?? 0);
        existente.proyeccionVenta += Number(item?.proyeccionVenta ?? 0);
      }
    }

    return Array.from(mapa.values()).map((row) => ({
      ...row,
      porcCump: row.cuotaLinea > 0 ? (row.ventaAcum / row.cuotaLinea) * 100 : 0,
      porcCumProy: row.cuotaLinea > 0 ? (row.proyeccionVenta / row.cuotaLinea) * 100 : 0,
    }));
  }

  protected consolidarPorCategoria(categorias: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const item of categorias) {
      const idCategoria = String(
        item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '',
      ).trim();
      const categoriaBase = this.obtenerNombreCategoria(item);
      const categoria = this.repararTextoCiudad(
        categoriaBase ||
          String(
            item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? idCategoria,
          ).trim(),
      ).trim();
      const key = categoria || idCategoria;

      if (!key) continue;

      const existente = mapa.get(key);
      if (!existente) {
        mapa.set(key, {
          ...item,
          id_categoria:
            idCategoria || item?.id_categoria || item?.idCategoria || item?.categoria_id,
          categoria: categoria || idCategoria || 'Sin categoría',
          cuota: Number(item?.cuota ?? 0),
          acumulado: Number(item?.acumulado ?? item?.ventaAcum ?? 0),
          ventaAcum: Number(item?.acumulado ?? item?.ventaAcum ?? 0),
          proyeccionVenta: Number(item?.proyeccionVenta ?? 0),
        });
      } else {
        existente.cuota += Number(item?.cuota ?? 0);
        existente.acumulado += Number(item?.acumulado ?? item?.ventaAcum ?? 0);
        existente.ventaAcum += Number(item?.acumulado ?? item?.ventaAcum ?? 0);
        existente.proyeccionVenta += Number(item?.proyeccionVenta ?? 0);
      }
    }

    return Array.from(mapa.values()).map((row) => ({
      ...row,
      porcCump: row.cuota > 0 ? (row.ventaAcum / row.cuota) * 100 : 0,
      porcCumProy: row.cuota > 0 ? (row.proyeccionVenta / row.cuota) * 100 : 0,
    }));
  }

  protected consolidarPorCiudad(ciudades: any[]): any[] {
    const mapa = new Map<string, any>();

    for (const item of ciudades) {
      const ciudad = this.repararTextoCiudad(item?.ciudad ?? '');
      if (!ciudad || this.esCiudadResumen(ciudad)) continue;

      const existente = mapa.get(ciudad);
      if (!existente) {
        mapa.set(ciudad, {
          ...item,
          ciudad,
          cuota: Number(item?.cuota ?? item?.cuotaCiudad ?? 0),
          ventaAcum: Number(item?.ventaAcum ?? 0),
          proyeccionVenta: Number(item?.proyeccionVenta ?? 0),
        });
      } else {
        existente.cuota += Number(item?.cuota ?? item?.cuotaCiudad ?? 0);
        existente.ventaAcum += Number(item?.ventaAcum ?? 0);
        existente.proyeccionVenta += Number(item?.proyeccionVenta ?? 0);
      }
    }

    return Array.from(mapa.values()).map((row) => ({
      ...row,
      porcCump: row.cuota > 0 ? (row.ventaAcum / row.cuota) * 100 : 0,
      porcCumProy: row.cuota > 0 ? (row.proyeccionVenta / row.cuota) * 100 : 0,
    }));
  }

  protected obtenerCuotaNumero(row: any): number {
    const valor =
      row?.[this.cuotaColumn] ??
      row?.cuotaMes ??
      row?.cuotaSemana ??
      row?.cuotaDiaria ??
      row?.cuota ??
      row?.cuotaLinea ??
      0;

    if (typeof valor === 'object' && valor) {
      const cuotaObj = this.esSemanal
        ? Number(valor?.cuota_semana ?? 0)
        : this._tipoCuota === 'diaria'
          ? Number(valor?.cuota_dia ?? 0)
          : Number(valor?.cuota_mes ?? 0);
      return Number.isFinite(cuotaObj) ? cuotaObj : 0;
    }

    const cuotaNum = Number(valor);
    return Number.isFinite(cuotaNum) ? cuotaNum : 0;
  }

  protected mapearDetalleAdminAVendedores(detalle: any[]): any[] {
    return detalle
      .filter(
        (row: any) => String(row?.codVendedor ?? row?.codigo_vendedor ?? '').trim() !== 'TOTALES',
      )
      .map((row: any) => ({
        ...row,
        codVendedor: String(row?.codVendedor ?? row?.codigo_vendedor ?? '').trim(),
        nombre: String(row?.nombre ?? ''),
        [this.cuotaColumn]: this.obtenerCuotaNumero(row),
        ventaAcum: Number(row?.ventaAcum ?? 0) || 0,
        porcCump: Number(row?.porcCump ?? 0) || 0,
        proyeccionVenta: Number(row?.proyeccionVenta ?? 0) || 0,
        porcCumProy:
          this.obtenerCuotaNumero(row) > 0
            ? ((Number(row?.proyeccionVenta ?? 0) || 0) / this.obtenerCuotaNumero(row)) * 100
            : 0,
      }));
  }

  protected pintarVistaVendedor(
    detalleVendedores: any[],
    filtrosConsulta: DashboardFilters,
    chartPrefix = 'chart-vendedor',
  ): void {
    this.chartType = 'bar';

    const codigosVendedorFiltro = this.normalizarValoresFiltro(filtrosConsulta.vendedores, filtrosConsulta.vendedor);
    const vendedoresFiltrados = codigosVendedorFiltro.length
      ? this.filtrarVendedoresMulti(detalleVendedores, codigosVendedorFiltro)
      : detalleVendedores;

    const vendedoresValidos = vendedoresFiltrados.filter(
      (v: any) => String(v?.codVendedor ?? v?.codigo_vendedor ?? '').trim() !== 'TOTALES',
    );

    this.tableData = [...vendedoresValidos].sort((a: any, b: any) => {
      if (this.rolId === RoleId.ADMINISTRADOR) {
        const codigoA = this.normalizarCodigoVendedor(a?.codVendedor ?? a?.codigo_vendedor ?? a?.codigo ?? '');
        const codigoB = this.normalizarCodigoVendedor(b?.codVendedor ?? b?.codigo_vendedor ?? b?.codigo ?? '');
        return codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
      }

      const nombreA = String(a?.nombre ?? a?.codVendedor ?? '').trim();
      const nombreB = String(b?.nombre ?? b?.codVendedor ?? '').trim();
      return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base', numeric: true });
    });

    const topVendedores = [...vendedoresValidos]
      .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 15);

    this.totalTopVendedores = topVendedores.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    this.chartData = topVendedores.map((v: any) => {
      const codigo = String(v?.codVendedor ?? '').trim();
      const nombre = String(v?.nombre ?? '').trim();

      return {
        name: nombre || codigo || 'Vendedor',
        value: Number(v?.ventaAcum ?? 0) || 0,
      };
    });

    this.chartId = `${chartPrefix}-${Date.now()}`;

    // Calcular totales para la vista por vendedor
    this.totalCuotaVendedor = vendedoresValidos.reduce(
      (sum: number, item: any) => sum + (Number(item?.[this.cuotaColumn] ?? 0) || 0),
      0,
    );
    this.totalAcumuladoVendedor = vendedoresValidos.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    this.cdr.markForCheck();
    this.emitirResumenVista();
  }

  protected agruparAdminPorCampo(detalle: any[], campo: string, campoSalida: string): any[] {
    const agg = new Map<string, any>();

    for (const row of detalle) {
      const keyRaw = String(row?.[campo] ?? '').trim() || 'Sin dato';
      const key = this.repararTextoCiudad(keyRaw);
      const cuota = this.obtenerCuotaNumero(row);
      const ventaAcum = Number(row?.ventaAcum ?? 0) || 0;
      const proyeccionVenta = Number(row?.proyeccionVenta ?? 0) || 0;

      const actual = agg.get(key) ?? {
        [campoSalida]: key,
        codigo: String(row?.reporteProvConObs ?? row?.codigoLinea ?? row?.linea ?? '').trim(),
        idProveedor: row?.idProveedor ?? row?.id_proveedor ?? null,
        cuotaLinea: 0,
        cuota: 0,
        ventaAcum: 0,
        acumulado: 0,
        proyeccionVenta: 0,
      };

      actual.cuotaLinea += cuota;
      actual.cuota += cuota;
      actual.ventaAcum += ventaAcum;
      actual.acumulado += ventaAcum;
      actual.proyeccionVenta += proyeccionVenta;

      agg.set(key, actual);
    }

    return Array.from(agg.values()).map((row) => ({
      ...row,
      porcCump: row.cuotaLinea > 0 ? (row.ventaAcum / row.cuotaLinea) * 100 : 0,
      porcentajeCumplimiento: row.cuota > 0 ? (row.acumulado / row.cuota) * 100 : 0,
      part: 0,
      proyectado: row.proyeccionVenta,
      porcCumProy: row.cuotaLinea > 0 ? (row.proyeccionVenta / row.cuotaLinea) * 100 : 0,
      porcentajeCumplimientoProyectado: row.cuota > 0 ? (row.proyeccionVenta / row.cuota) * 100 : 0,
    }));
  }

  /**
   * Normaliza un valor de filtro que puede llegar como:
   *   - array (multi-select nuevo: filtros.vendedores[], filtros.proveedores[])
   *   - string comma-separated (legacy: filtros.vendedor, filtros.proveedor)
   *   - string simple
   * Devuelve siempre array de strings limpio.
   */
  protected normalizarValoresFiltro(arr: unknown, legacy: unknown): string[] {
    const fromArr = Array.isArray(arr)
      ? arr.map((v) => String(v ?? '').trim()).filter(Boolean)
      : [];
    if (fromArr.length) return fromArr;
    const raw = String(legacy ?? '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((v) => String(v).trim())
      .filter(Boolean);
  }

  /**
   * Filtra una lista de filas por codigo_vendedor (soporta array multi).
   * El array es OR (la fila pasa si coincide con CUALQUIER codigo).
   */
  protected filtrarVendedoresMulti(listado: any[], codigos: string[]): any[] {
    if (!Array.isArray(codigos) || codigos.length === 0) return listado;
    return listado.filter((item: any) => {
      const valoresFila = [
        item?.codVendedor,
        item?.codigo_vendedor,
        item?.codigoVendedor,
        item?.id_vendedor,
        item?.idVendedor,
        item?.idVendedorAsociado,
      ]
        .map((valor) => String(valor ?? '').trim())
        .filter(Boolean);

      return codigos.some((codigo) => {
        const numerico = String(codigo).replace(/\D/g, '');
        const codigoNorm = numerico ? numerico.padStart(4, '0') : String(codigo);
        const sinCeros = numerico ? String(Number(numerico)) : String(codigo);

        return valoresFila.some((vf) => {
          const vfNum = vf.replace(/\D/g, '');
          const vfNorm = vfNum ? vfNum.padStart(4, '0') : vf;
          const vfSinCeros = vfNum ? String(Number(vfNum)) : vf;
          return vf === codigo || vfNorm === codigoNorm || vfSinCeros === sinCeros;
        });
      });
    });
  }

  /**
   * Filtra una lista por linea/proveedor (soporta array multi).
   * El array es OR (la fila pasa si coincide con CUALQUIER codigo).
   */
  protected filtrarProveedoresMulti(listado: any[], codigos: string[]): any[] {
    if (!Array.isArray(codigos) || codigos.length === 0) return listado;
    return listado.filter((item: any) => {
      const idProveedor = String(item?.idProveedor ?? item?.id_proveedor ?? '').trim();
      const codigoProveedor = String(item?.codigoProveedor ?? item?.codigo_proveedor ?? '').trim();
      const codigoLinea = String(item?.codigoLinea ?? item?.codigo_linea ?? '').trim();
      const linea = String(item?.linea ?? '').trim();
      const reporte = String(item?.reporteProvConObs ?? item?.proveedor ?? '').trim();
      const codigoAgrupado = String(item?.codigo ?? '').trim();

      const codigosFilaRaw = [
        idProveedor,
        codigoProveedor,
        codigoLinea,
        linea,
        reporte,
        codigoAgrupado
      ]
        .map((v) => v.trim())
        .filter(Boolean);

      const codigosNumericosFila = new Set(
        codigosFilaRaw
          .map((v) => (v.match(/^\d+/) ?? [])[0])
          .filter(Boolean)
      );

      return codigos.some((codigo) => {
        const codigoTrim = String(codigo).trim();
        if (!codigoTrim) return false;
        if (codigosFilaRaw.some((v) => v === codigoTrim)) return true;
        const codeNum = (codigoTrim.match(/^\d+/) ?? [])[0];
        if (codeNum && codigosNumericosFila.has(codeNum)) return true;
        if (reporte && reporte.toLowerCase().startsWith(codigoTrim.toLowerCase())) return true;
        if (codigoAgrupado && codigoAgrupado.toLowerCase().startsWith(codigoTrim.toLowerCase())) return true;
        return false;
      });
    });
  }
}
