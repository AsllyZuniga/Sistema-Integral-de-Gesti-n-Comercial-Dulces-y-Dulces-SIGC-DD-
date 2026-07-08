import { Directive } from '@angular/core';
import { takeUntil } from 'rxjs';
import { DashboardFilters } from '../../../../../shared/components/filters/filters.component';
import { VentasClientesBase } from './ventas-clientes-base';
import { normalizarTextoFiltro } from '../../../../../shared/utils/text-normalization.util';
import { repararNombreMunicipio } from '../../../../../shared/utils/narino-municipios.util';

@Directive()
export abstract class VentasUtilidadesBase extends VentasClientesBase {

  protected repararTextoCiudad(valor: unknown): string {
    const txt = String(valor ?? '').trim();
    if (!txt) return '';

    const saneado = normalizarTextoFiltro(
      txt.replace(/◊/g, 'ñ').replace(/Ø/g, 'Ñ'),
    );

    // El backend entrega los municipios sin tildes a partir de febrero
    // (enero sí viene bien). El util `repararNombreMunicipio` los repara
    // contra el diccionario canónico de Nariño con fuzzy match Levenshtein.
    // Si el valor no matchea con ningún municipio conocido (categoría,
    // línea, etc.) lo devuelve saneado tal cual.
    return repararNombreMunicipio(saneado);
  }

  protected normalizarTexto(valor: unknown): string {
    return this.repararTextoCiudad(valor)
      .toLowerCase()
      .replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ0-9\s.,-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  protected esCiudadResumen(valor: unknown): boolean {
    const ciudad = this.normalizarTexto(valor);
    return ciudad === 'total' || ciudad === 'totales' || ciudad === 'todas' || ciudad === 'todos';
  }

  /**
   * Normaliza un valor de filtro que puede llegar como:
   *   - array (multi-select nuevo: filtros.vendedores[], filtros.proveedores[])
   *   - string comma-separated (legacy: filtros.vendedor, filtros.proveedor)
   *   - string simple
   * Devuelve siempre array de strings limpio.
   */
  protected filtrarPorCiudadSeleccionada(listado: any[]): any[] {
    const ciudadesValidas = listado.filter((item: any) => !this.esCiudadResumen(item?.ciudad));

    // Soporta array multi por id (filtros.ciudades[]), string legacy y nombres visibles.
    // Esto evita vaciar la tabla cuando el endpoint ya filtró por id_ciudad=71
    // pero la respuesta solo trae ciudad='Pasto' sin id_ciudad.
    const ciudadesPorId = this.normalizarValoresFiltro(
      this._filtros.ciudades,
      this._filtros.ciudad
    );
    const ciudadesPorNombre = this.normalizarValoresFiltro(
      this._filtros.ciudadesNombres,
      this._filtros.ciudadNombre
    );
    const ciudadesFiltro = Array.from(new Set([...ciudadesPorId, ...ciudadesPorNombre]));

    if (ciudadesFiltro.length === 0) return ciudadesValidas;

    return ciudadesValidas.filter((item: any) => {
      const ciudadItem = this.normalizarTexto(item?.ciudad ?? item?.nomCiudad ?? item?.nombreCiudad ?? '');
      const idItem = String(item?.id_ciudad ?? item?.idCiudad ?? item?.codCiudad ?? item?.codigoCiudad ?? '').trim();
      return ciudadesFiltro.some((cf) => {
        const cfTrim = String(cf).trim();
        if (!cfTrim) return false;
        // Match por id (numérico) si ambas partes lo tienen
        if (idItem && cfTrim === idItem) return true;
        // Match por nombre
        const cfNorm = this.normalizarTexto(this.repararTextoCiudad(cf));
        return ciudadItem === cfNorm;
      });
    });
  }

  /**
   * Filtra un listado de filas (no agrupado) por las ciudades
   * seleccionadas. Acepta array (multi) o string singular. Match por
   * id_ciudad (preferente) o por nombre de ciudad. Se usa ANTES de
   * agrupar para preservar el id en las filas resultantes.
   */
  protected filtrarDetallePorCiudad(
    listado: any[],
    ciudadesMulti: string[] | null | undefined,
    ciudadSingular: string | null | undefined,
    ciudadNombre: string | null | undefined,
  ): any[] {
    const ciudadesFiltro = this.normalizarValoresFiltro(
      ciudadesMulti,
      ciudadNombre ?? ciudadSingular
    );
    if (ciudadesFiltro.length === 0) return listado;

    return listado.filter((item: any) => {
      const idItem = String(item?.id_ciudad ?? '').trim();
      const ciudadItem = this.normalizarTexto(item?.ciudad ?? '');
      return ciudadesFiltro.some((cf) => {
        const cfTrim = String(cf).trim();
        if (idItem && cfTrim === idItem) return true;
        const cfNorm = this.normalizarTexto(this.repararTextoCiudad(cf));
        return ciudadItem === cfNorm;
      });
    });
  }

  protected limpiarNombreCategoria(valor: unknown): string {
    let nombre = this.repararTextoCiudad(valor);
    if (!nombre) return '';

    // Algunas categorías llegan con doble código antepuesto, ej.
    // "0101 - 1000-COMPOTAS" (código de categoría + código de línea/grupo).
    // Se quitan todos los prefijos numéricos con guion, con o sin espacios.
    nombre = nombre.replace(/^(\s*\d+\s*-\s*)+/u, '');
    return nombre.trim();
  }

  protected normalizarCategoria(valor: unknown): string {
    return this.normalizarTexto(this.limpiarNombreCategoria(valor));
  }

  protected coincideCategoria(valorA: unknown, valorB: unknown): boolean {
    const aBruto = this.normalizarTexto(this.repararTextoCiudad(valorA));
    const bBruto = this.normalizarTexto(this.repararTextoCiudad(valorB));
    const aNormal = this.normalizarCategoria(valorA);
    const bNormal = this.normalizarCategoria(valorB);

    return (
      aBruto === bBruto ||
      aNormal === bNormal ||
      aBruto.includes(bBruto) ||
      bBruto.includes(aBruto) ||
      aNormal.includes(bNormal) ||
      bNormal.includes(aNormal)
    );
  }

  protected cargarMapaCategorias(): void {
    this.cumplimientoService
      .getCuotaCategoriasPorVendedores()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: any) => {
        const detalle = Array.isArray(res?.detalle) ? res.detalle : [];
        const mapa = new Map<string, string>();

        for (const item of detalle) {
          const id = String(
            item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '',
          ).trim();
          const nombre = this.repararTextoCiudad(
            item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
          ).trim();

          if (id && nombre) {
            mapa.set(id, nombre);
          }
        }

        if (mapa.size === 0) return;

        this.categoriasPorId = mapa;

        if (this.iniciado && this.esModoAdminTodos() && this.activeVentasView === 'categoria') {
          this.solicitarCargaVista(true);
        }
      });
  }

  protected obtenerNombreCategoria(item: any): string {
    const nombreDirecto = this.limpiarNombreCategoria(
      item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
    );
    if (nombreDirecto && !/^\d+$/u.test(nombreDirecto)) return nombreDirecto;

    const idCategoria = String(
      item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? nombreDirecto ?? '',
    ).trim();

    if (!idCategoria) return '';

    return this.categoriasPorId.get(idCategoria) ?? `Categoría ${idCategoria}`;
  }

  protected ordenarCategoriasPorAlfabeto(listado: any[]): any[] {
    return [...listado].sort((a, b) => {
      const nombreA = this.normalizarCategoria(this.obtenerNombreCategoria(a));
      const nombreB = this.normalizarCategoria(this.obtenerNombreCategoria(b));

      const cmp = nombreA.localeCompare(nombreB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return cmp;

      return String(a?.categoria ?? '').localeCompare(String(b?.categoria ?? ''), 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });
  }

  protected filtrarCategorias(listado: any[], categoriaFiltroRaw: unknown): any[] {
    // Acepta cadena o array de valores (ids o nombres). Normaliza todo a minúsculas sin acentos.
    const filtros: string[] = Array.isArray(categoriaFiltroRaw)
      ? (categoriaFiltroRaw as unknown[]).map((v) => this.normalizarCategoria(v)).filter(Boolean)
      : ((): string[] => {
          const raw = String(categoriaFiltroRaw ?? '').trim();
          return raw ? [this.normalizarCategoria(raw)] : [];
        })();

    if (!filtros.length) return listado;

    const setFiltros = new Set(filtros);

    return listado.filter((item: any) => {
      const nombreItem = this.normalizarCategoria(this.obtenerNombreCategoria(item));
      const idItem = this.normalizarCategoria(
        String(item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? ''),
      );

      return setFiltros.has(nombreItem) || (idItem && setFiltros.has(idItem));
    });
  }

  protected construirCategoriasSeleccionadas(listado: any[], categoriaFiltroRaw: unknown): any[] {
    const categoriasSeleccionadas = Array.isArray(categoriaFiltroRaw)
      ? (categoriaFiltroRaw as unknown[]).map((v) => this.normalizarCategoria(v)).filter(Boolean)
      : ((): string[] => {
          const raw = this.normalizarCategoria(categoriaFiltroRaw);
          return raw ? [raw] : [];
        })();

    if (categoriasSeleccionadas.length <= 1) {
      return this.filtrarCategorias(listado, categoriaFiltroRaw);
    }

    const mapa = new Map<string, any>();

    for (const item of listado) {
      const nombre = this.normalizarCategoria(this.obtenerNombreCategoria(item));
      const id = this.normalizarCategoria(
        String(item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? ''),
      );

      if (nombre) mapa.set(nombre, item);
      if (id) mapa.set(id, item);
    }

    return categoriasSeleccionadas.map((categoria) => {
      const coincidencia = mapa.get(categoria);
      if (coincidencia) return coincidencia;

      const encontrada = listado.find((item: any) => {
        const nombre = this.normalizarCategoria(this.obtenerNombreCategoria(item));
        const id = this.normalizarCategoria(
          String(item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? ''),
        );

        return nombre === categoria || id === categoria;
      });

      return (
        encontrada ?? {
          id_categoria: categoria,
          categoria,
          cuota: 0,
          acumulado: 0,
          ventaAcum: 0,
          proyeccionVenta: 0,
          porcCump: 0,
          porcCumProy: 0,
        }
      );
    });
  }

  protected filtrarCategoriasReales(listado: any[], categoriaFiltroRaw: unknown): any[] {
    const categoriasSeleccionadas = (Array.isArray(categoriaFiltroRaw)
      ? categoriaFiltroRaw
      : [categoriaFiltroRaw]
    )
      .map((v) => String(v ?? '').trim())
      .filter(Boolean);

    if (!categoriasSeleccionadas.length) {
      return listado;
    }

    const setCategorias = new Set(categoriasSeleccionadas.map((c) => c.toLowerCase()));

    const filtrado = listado.filter((item: any) => {
      const codigoItem = String(
        item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '',
      ).trim();
      const nombreCompletoItem = String(
        item?.categoria ?? item?.nomCategoria ?? item?.nombreCategoria ?? '',
      ).trim();
      const codigoItemLower = codigoItem.toLowerCase();
      const nombreItemLower = nombreCompletoItem.toLowerCase();

      return categoriasSeleccionadas.some((catOriginal) => {
        const cat = String(catOriginal ?? '').trim();
        const catLower = cat.toLowerCase();

        if (!cat) return false;

        if (codigoItem && codigoItem === cat) return true;
        if (nombreCompletoItem && nombreCompletoItem === cat) return true;

        if (codigoItem && nombreCompletoItem.startsWith(codigoItem)) {
          if (cat.startsWith(codigoItem)) return true;
        }

        if (cat && nombreCompletoItem.startsWith(cat + ' ')) return true;
        if (cat && nombreCompletoItem.startsWith(cat + '-')) return true;

        const nombreNormalizado = this.normalizarCategoria(
          this.obtenerNombreCategoria(item) || nombreCompletoItem,
        );
        const catNormalizado = this.normalizarCategoria(catOriginal);
        if (nombreNormalizado && catNormalizado && nombreNormalizado === catNormalizado) {
          return true;
        }

        if (setCategorias.has(codigoItemLower) || setCategorias.has(nombreItemLower)) {
          return true;
        }

        return false;
      });
    });

    return filtrado;
  }

  protected completarCategoriasSinDatos(listado: any[], categoriaFiltroRaw: unknown): any[] {
    const categoriasSeleccionadas = Array.isArray(categoriaFiltroRaw)
      ? (categoriaFiltroRaw as unknown[]).map((v) => this.normalizarCategoria(v)).filter(Boolean)
      : ((): string[] => {
          const categoria = this.normalizarCategoria(categoriaFiltroRaw);
          return categoria ? [categoria] : [];
        })();

    if (categoriasSeleccionadas.length === 0 || this.categoriasPorId.size === 0) {
      if (categoriasSeleccionadas.length > 0) return listado;
    }

    if (categoriasSeleccionadas.length === 1) return listado;

    const existentes = new Set<string>();

    for (const item of listado) {
      const nombre = this.normalizarCategoria(this.obtenerNombreCategoria(item));
      const id = String(item?.id_categoria ?? item?.idCategoria ?? item?.categoria_id ?? '').trim();

      if (nombre) existentes.add(nombre);
      if (id) existentes.add(this.normalizarCategoria(id));
    }

    const faltantes = categoriasSeleccionadas
      .filter((categoria) => !existentes.has(categoria))
      .map((categoria) => {
        const encontrada = Array.from(this.categoriasPorId.entries()).find(([id, nombre]) => {
          const idNorm = this.normalizarCategoria(id);
          const nombreNorm = this.normalizarCategoria(nombre);
          return idNorm === categoria || nombreNorm === categoria;
        });

        const id = encontrada?.[0] ?? categoria;
        const nombre = encontrada?.[1] ?? categoria;

        return {
          id_categoria: id,
          categoria: nombre,
          cuota: 0,
          acumulado: 0,
          ventaAcum: 0,
          proyeccionVenta: 0,
          porcCump: 0,
          porcCumProy: 0,
        };
      })
      ;

    return [...listado, ...faltantes];
  }

  protected formatearMoneda(valor: unknown): string {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : 0;
    return `$ ${seguro.toLocaleString('es-CO')}`;
  }

  protected formatearMonedaCompacta(valor: unknown): string {
    const numero = Number(valor);
    const seguro = Number.isFinite(numero) ? numero : 0;
    if (Math.abs(seguro) >= 1_000_000) {
      return `$${(seguro / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(seguro) >= 1_000) {
      return `$${(seguro / 1_000).toFixed(0)}K`;
    }
    return `$${seguro.toLocaleString('es-CO')}`;
  }

  protected nombreProveedorCard(lineaRaw: unknown): string {
    const linea = String(lineaRaw ?? '').trim();
    if (!linea) return '—';
    const sinCodigo = linea.replace(/^(\s*\d+\s*-\s*)+/u, '').trim();
    return sinCodigo || linea;
  }

  protected normalizarCodigoVendedor(valor: unknown): string {
    const codigo = String(valor ?? '').trim();
    if (!codigo) return '';
    return /^\d+$/.test(codigo) && codigo.length < 4 ? codigo.padStart(4, '0') : codigo;
  }

  protected obtenerIdVendedorSesion(): string {
    const usuario = this.authService.getVendedor();
    const idRaw =
      usuario?.idVendedor ??
      usuario?.id_vendedor ??
      usuario?.idVendedorAsociado ??
      usuario?.vendedor?.idVendedor ??
      usuario?.vendedor?.id_vendedor ??
      usuario?.vendedor?.id ??
      usuario?.id ??
      '';
    return String(idRaw ?? '').trim();
  }

  protected mapearCuotaPorLinea(listado: any[]): any[] {
    return listado.map((item: any) => {
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
        cuotaLinea: Number(item?.cuotaProveedorTotal ?? item?.cuotaProveedor ?? item?.cuotaLinea ?? 0),
        ventaAcum: Number(item?.ventaAcum ?? item?.acumulado ?? 0),
        proyeccionVenta: Number(item?.proyeccionVenta ?? item?.proyeccion ?? 0),
      };
    });
  }

  protected filtrarProveedores(listado: any[], codigoProveedor: string): any[] {
    const filtroRaw = String(codigoProveedor ?? '').trim();
    console.debug('[Ventas] filtrarProveedores called with:', { filtroRaw, proveedoresCount: listado?.length });
    if (!filtroRaw) return listado;

    const filtros = filtroRaw
      .split(',')
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .map((v) => {
        const code = (v.match(/^\d+/)?.[0] ?? v).trim();
        const codeSinCeros = code.replace(/^0+/, '') || code;
        return {
          raw: v,
          rawNorm: this.normalizarTexto(v),
          code,
          codeSinCeros,
        };
      });

    if (!filtros.length) return listado;

    return listado.filter((item: any) => {
      const idProveedor = String(item?.idProveedor ?? item?.id_proveedor ?? '').trim();
      const codigoProveedor = String(item?.codigoProveedor ?? item?.codigo_proveedor ?? '').trim();
      const codigoLinea = String(item?.codigoLinea ?? item?.codigo_linea ?? '').trim();
      const linea = String(item?.linea ?? '').trim();
      const reporte = String(item?.reporteProvConObs ?? item?.proveedor ?? '').trim();

      const codigoLineaCode = (codigoLinea.match(/^\d+/)?.[0] ?? '').trim();
      const lineaCode = (linea.match(/^\d+/)?.[0] ?? '').trim();
      const idProveedorCode = (idProveedor.match(/^\d+/)?.[0] ?? '').trim();
      const codigoProveedorCode = (codigoProveedor.match(/^\d+/)?.[0] ?? '').trim();
      const normalizarCodigoProveedor = (valor: string): string =>
        (valor || '').replace(/^0+/, '') || valor;

      const hayCoincidencia = filtros.some((f) => {
        const fCode = f.code;

        if (idProveedor && f.raw === idProveedor) return true;
        if (codigoProveedor && f.raw === codigoProveedor) return true;
        if (codigoLinea && f.raw === codigoLinea) return true;
        if (linea && f.raw === linea) return true;

        const codigosFila = [idProveedorCode, codigoProveedorCode, codigoLineaCode, lineaCode]
          .filter(Boolean)
          .map((codigo) => ({ original: codigo, sinCeros: normalizarCodigoProveedor(codigo) }));

        if (fCode && codigosFila.some((codigo) => codigo.original === fCode)) return true;
        if (f.codeSinCeros && codigosFila.some((codigo) => codigo.sinCeros === f.codeSinCeros)) {
          return true;
        }

        const lineaNorm = this.normalizarTexto(linea);
        const codigoLineaNorm = this.normalizarTexto(codigoLinea);
        const codigoProveedorNorm = this.normalizarTexto(codigoProveedor);
        const reporteNorm = this.normalizarTexto(reporte);

        if (
          f.rawNorm &&
          (lineaNorm.includes(f.rawNorm) ||
            codigoLineaNorm.includes(f.rawNorm) ||
            codigoProveedorNorm.includes(f.rawNorm))
        ) {
          return true;
        }

        if (f.rawNorm && reporteNorm.includes(f.rawNorm)) return true;

        // Intento extra de coincidencia: comparar con una versión limpia del nombre
        const proveedorLabel = this.normalizarTexto(
          this.repararTextoCiudad(linea || reporte || codigoProveedor || idProveedor || ''),
        );

        if (f.rawNorm && proveedorLabel.includes(f.rawNorm)) return true;

        return false;
      });

      return hayCoincidencia;
    });
  }

  protected filtrarVendedores(listado: any[], codigoVendedor: string): any[] {
    const codigoRaw = String(codigoVendedor ?? '').trim();
    if (!codigoRaw) return listado;

    const match = codigoRaw.match(/^\s*(\d+)/);
    const codigo = match?.[1] ? match[1].padStart(4, '0') : codigoRaw;
    const codigoSinCeros = codigo.replace(/^0+/, '') || codigo;

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

      return valoresFila.some((valorFila) => {
        const numerico = valorFila.replace(/\D/g, '');
        const valorNormalizado = numerico ? numerico.padStart(4, '0') : valorFila;
        const valorSinCeros = numerico ? String(Number(numerico)) : valorFila;

        return (
          valorFila === codigo ||
          valorNormalizado === codigo ||
          valorSinCeros === codigoSinCeros ||
          valorFila === codigoSinCeros
        );
      });
    });
  }

  protected quitarProveedorDeFiltros(filtros: DashboardFilters): DashboardFilters {
    return {
      ...filtros,
      proveedor: '',
      proveedorNombre: '',
      proveedorNombres: [],
      proveedores: [],
    };
  }

  protected nombreProveedorOrden(item: any): string {
    const linea = String(item?.linea ?? '').trim();
    if (!linea) return '';

    // El nombre ya llega sin código antepuesto (ver nombreProveedorCard),
    // pero se limpia aquí también por si algún caller pasa el valor crudo.
    const nombre = this.nombreProveedorCard(linea);

    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  protected ordenarProveedoresPorAlfabeto(listado: any[]): any[] {
    return [...listado].sort((a, b) => {
      const nombreA = this.nombreProveedorOrden(a);
      const nombreB = this.nombreProveedorOrden(b);

      const cmp = nombreA.localeCompare(nombreB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });

      if (cmp !== 0) return cmp;

      const lineaA = String(a?.linea ?? '').trim();
      const lineaB = String(b?.linea ?? '').trim();
      return lineaA.localeCompare(lineaB, 'es', { sensitivity: 'base', numeric: true });
    });
  }

  protected limitarTopProveedores(listado: any[]): any[] {
    return [...listado]
      .sort((a, b) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 12);
  }

  protected formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  protected obtenerRangoMesActual(): { inicioMes: string; finMes: string } {
    const hoy = new Date();
    return {
      inicioMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
      finMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
    };
  }

  protected obtenerRangoMesAnterior(): { inicioMes: string; finMes: string } {
    const hoy = new Date();
    return {
      inicioMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      finMes: this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    };
  }

  protected esRangoMesActual(fechaInicio: string, fechaFin: string): boolean {
    const { inicioMes, finMes } = this.obtenerRangoMesActual();
    return fechaInicio === inicioMes && fechaFin === finMes;
  }

  protected aplicarFechasPorDefecto(filtros: DashboardFilters): DashboardFilters {
    const { inicioMes, finMes } = this.obtenerRangoMesActual();

    return {
      ...filtros,
      fechaInicio: String(filtros?.fechaInicio ?? '').trim() || inicioMes,
      fechaFin: String(filtros?.fechaFin ?? '').trim() || finMes,
    };
  }

  protected vistaUsaUltimoMesPorDefecto(view: string): boolean {
    return false;
  }

  protected aplicarUltimoMesCargadoPorDefecto(filtros: DashboardFilters): DashboardFilters {
    const fechaInicio = String(filtros?.fechaInicio ?? '').trim();
    const fechaFin = String(filtros?.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin || this.esRangoMesActual(fechaInicio, fechaFin)) {
      const { inicioMes, finMes } = this.obtenerRangoMesAnterior();
      return {
        ...filtros,
        fechaInicio: inicioMes,
        fechaFin: finMes,
      };
    }

    return {
      ...filtros,
      fechaInicio,
      fechaFin,
    };
  }

  protected obtenerFiltrosMesAnteriorDesde(
    filtros: DashboardFilters,
    mesesAtras: number,
  ): DashboardFilters {
    const hoy = new Date();
    const inicioMes = this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras, 1));
    const finMes = this.formatDate(new Date(hoy.getFullYear(), hoy.getMonth() - mesesAtras + 1, 0));

    return {
      ...filtros,
      fechaInicio: inicioMes,
      fechaFin: finMes,
    };
  }

  protected debeAplicarFallbackAutomatico(filtros: DashboardFilters): boolean {
    const fechaInicio = String(filtros?.fechaInicio ?? '').trim();
    const fechaFin = String(filtros?.fechaFin ?? '').trim();
    return this.esRangoMesActual(fechaInicio, fechaFin);
  }

  protected construirCandidatosFallback(
    filtros: DashboardFilters,
    maxMesesAtras = 6,
  ): DashboardFilters[] {
    const candidatos: DashboardFilters[] = [filtros];
    for (let i = 1; i <= maxMesesAtras; i += 1) {
      candidatos.push(this.obtenerFiltrosMesAnteriorDesde(filtros, i));
    }
    return candidatos;
  }
}
