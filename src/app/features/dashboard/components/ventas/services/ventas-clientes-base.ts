import { Directive } from '@angular/core';
import { merge, takeUntil } from 'rxjs';
import { RoleId } from '../../../../../core/auth/roles';
import { DashboardFilters } from '../../../../../shared/components/filters/filters.component';
import { VentasTransformacionesBase } from './ventas-transformaciones-base';

@Directive()
export abstract class VentasClientesBase extends VentasTransformacionesBase {

  protected abstract formatearMoneda(valor: unknown): string;
  protected abstract formatearMonedaCompacta(valor: unknown): string;

  protected recalcularChart(): void {
    const agg = new Map<string, { subtotal: number }>();

    for (const row of this.allItemData) {
      const key = row.Descripcion ?? 'SIN DESCRIPCION';
      const actual = agg.get(key) ?? { subtotal: 0 };
      actual.subtotal += this.calcularVentaRow(row);
      agg.set(key, actual);
    }

    const topItems = Array.from(agg.entries())
      .map(([name, value]) => ({ name, value: Number(value?.subtotal ?? 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    this.totalTopItemsSubtotal = topItems.reduce(
      (sum: number, item: any) => sum + (Number(item?.value ?? 0) || 0),
      0,
    );
    this.chartData = topItems;

    this.chartId = 'chart-item-' + Date.now();
    this.cdr.markForCheck();
  }

  protected obtenerNombreCliente(row: any): string {
    const nombre =
      row?.cliente ??
      row?.razon_social ??
      row?.razonSocial ??
      row?.nombre_establecimiento ??
      row?.nombreEstablecimiento ??
      row?.Cliente ??
      row?.nombreCliente ??
      row?.Nombre_Cliente ??
      row?.Razon_Social ??
      '';

    return this.repararTextoCiudad(String(nombre).trim());
  }

  protected obtenerSucursalCliente(row: any): string {
    const sucursal =
      row?.sucursal ??
      row?.Sucursal ??
      row?.nombre_establecimiento ??
      row?.nombreEstablecimiento ??
      row?.nombreSucursal ??
      row?.Nombre_Sucursal ??
      row?.sede ??
      row?.Sede ??
      'Sin sucursal';

    return this.repararTextoCiudad(String(sucursal).trim()) || 'Sin sucursal';
  }

  protected obtenerCodigoItem(row: any): string {
    const codigo =
      row?.id_item ??
      row?.codigo_item ??
      row?.Cod_Item ??
      row?.cod_item ??
      row?.codigoItem ??
      row?.codigo ??
      '';
    return String(codigo).trim() || '—';
  }

  protected obtenerIdClienteSucursal(row: any): string {
    const id =
      row?.id_cliente ?? row?.id_cliente_sucursal ?? row?.idClienteSucursal ?? row?.idCliente ?? '';
    return String(id).trim();
  }

  protected obtenerDocumentoCliente(row: any): string {
    const doc =
      row?.numero_documento ??
      row?.nro_documento ??
      row?.numeroDocumento ??
      row?.documento ??
      row?.nit ??
      '';
    return String(doc).trim() || '—';
  }

  protected obtenerFechaVenta(row: any): string {
    const fecha =
      row?.ultima_venta ??
      row?.ultimaVenta ??
      row?.Ultima_Venta ??
      row?.primera_venta ??
      row?.primeraVenta ??
      row?.Primera_Venta ??
      row?.fecha ??
      row?.Fecha ??
      row?.fecha_venta ??
      row?.fechaVenta ??
      row?.fecha_documento ??
      row?.fechaDocumento ??
      row?.Fecha_Documento ??
      row?.Fecha_Doc ??
      row?.createdAt ??
      row?.created_at ??
      '';
    return String(fecha).trim();
  }

  protected parseFechaFlexible(fechaRaw: string): Date | null {
    const fecha = String(fechaRaw ?? '').trim();
    if (!fecha) return null;

    // Aceptar timestamps numéricos en segundos (10 dígitos) o milisegundos (13 dígitos)
    const soloDigitos = /^\d{10,13}$/.test(fecha);
    if (soloDigitos) {
      let n = Number(fecha);
      if (fecha.length === 10) n = n * 1000; // segundos -> ms
      const dNum = new Date(n);
      return Number.isNaN(dNum.getTime()) ? null : dNum;
    }

    const soloFechaIso = /^\d{4}-\d{2}-\d{2}$/;
    if (soloFechaIso.test(fecha)) {
      const d = new Date(`${fecha}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const fechaHoraIso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;
    if (fechaHoraIso.test(fecha)) {
      const normalizada = fecha.includes('T') ? fecha : fecha.replace(' ', 'T');
      const d = new Date(normalizada);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const latino = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/;
    const matchLatino = fecha.match(latino);
    if (matchLatino) {
      const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = matchLatino;
      const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const intento = new Date(fecha);
    return Number.isNaN(intento.getTime()) ? null : intento;
  }

  protected parseFechaOrden(fechaRaw: string): number {
    const fecha = this.parseFechaFlexible(fechaRaw);
    return fecha ? fecha.getTime() : Number.MAX_SAFE_INTEGER;
  }

  protected ordenarDetalleItemsPorFechaAsc(listado: any[]): any[] {
    return [...listado].sort((a: any, b: any) => {
      const proveedorA = String(a?.Proveedor ?? a?.proveedor ?? '').trim();
      const proveedorB = String(b?.Proveedor ?? b?.proveedor ?? '').trim();
      const cmpProveedor = proveedorA.localeCompare(proveedorB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmpProveedor !== 0) return cmpProveedor;

      const descripcionA = this.obtenerDescripcionItem(a);
      const descripcionB = this.obtenerDescripcionItem(b);
      const cmpDescripcion = descripcionA.localeCompare(descripcionB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmpDescripcion !== 0) return cmpDescripcion;

      const codigoA = this.obtenerCodigoItem(a);
      const codigoB = this.obtenerCodigoItem(b);
      return codigoA.localeCompare(codigoB, 'es', {
        sensitivity: 'base',
        numeric: true,
      });
    });
  }

  protected formatearFechaCorta(fechaIso: string): string {
    if (!fechaIso) return 'Sin fecha';
    const fecha = this.parseFechaFlexible(fechaIso);
    if (!fecha) return 'Sin fecha';
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
  }

  protected obtenerInicialesCliente(nombre: string): string {
    const limpio = String(nombre ?? '')
      .trim()
      .replace(/\s+/g, ' ');
    if (!limpio) return 'CL';

    const partes = limpio.split(' ').slice(0, 2);
    const iniciales = partes.map((p) => p.charAt(0).toUpperCase()).join('');
    return iniciales || 'CL';
  }

  protected obtenerDescripcionItem(row: any): string {
    const descripcion = row?.Descripcion ?? row?.descripcion ?? row?.producto ?? 'Sin descripción';
    return this.repararTextoCiudad(String(descripcion).trim()) || 'Sin descripción';
  }

  protected obtenerCantidadItem(row: any): number {
    const cantidad =
      row?.cantidad_total ?? row?.Cantidad ?? row?.cantidad ?? row?.Venta_Unid_Cajas ?? 0;
    const num = Number(cantidad);
    return Number.isFinite(num) ? num : 0;
  }

  protected obtenerPrecioUnitarioItem(row: any): number {
    const valor =
      row?.precio_unitario ?? row?.precioUnitario ?? row?.Precio_Unitario ?? row?.precio ?? 0;
    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  protected calcularVentaRow(row: any): number {
    const valor =
      row?.subtotal_producto ??
      row?.subtotalProducto ??
      row?.subtotal_total ??
      row?.Subtotal ??
      row?.subTotal ??
      row?.ventaAcum ??
      row?.valorTotal ??
      0;
    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  protected construirDetalleClientes(rows: any[]): any[] {
    const agg = new Map<
      string,
      {
        key: string;
        idClienteSucursal: string;
        documento: string;
        cliente: string;
        sucursal: string;
        cantidadItems: number;
        cantidadTotal: number;
        ventaAcum: number;
        expandido: boolean;
        ultimaCompra: string;
        ultimaCompraLabel: string;
        iniciales: string;
        progressItems: number;
        productos: any[];
      }
    >();

    for (const row of rows) {
      const idClienteSucursal = this.obtenerIdClienteSucursal(row);
      const cliente = this.obtenerNombreCliente(row);
      if (!cliente) continue;

      const sucursal = this.obtenerSucursalCliente(row);
      const key = idClienteSucursal || `${cliente}::${sucursal}`;

      const actual = agg.get(key) ?? {
        key,
        idClienteSucursal,
        documento: this.obtenerDocumentoCliente(row),
        cliente,
        sucursal,
        cantidadItems: 0,
        cantidadTotal: 0,
        ventaAcum: 0,
        expandido: false,
        ultimaCompra: '',
        ultimaCompraLabel: 'Sin fecha',
        iniciales: this.obtenerInicialesCliente(cliente),
        progressItems: 0,
        productos: [],
      };

      const fechaVenta = this.obtenerFechaVenta(row);
      if (fechaVenta && (!actual.ultimaCompra || fechaVenta > actual.ultimaCompra)) {
        actual.ultimaCompra = fechaVenta;
        actual.ultimaCompraLabel = this.formatearFechaCorta(fechaVenta);
        actual.documento = this.obtenerDocumentoCliente(row);
      }

      actual.cantidadItems += 1;
      actual.cantidadTotal += this.obtenerCantidadItem(row);
      actual.ventaAcum += this.calcularVentaRow(row);
      actual.productos.push({
        id_item: this.obtenerCodigoItem(row),
        fecha: fechaVenta || '—',
        numero_documento: this.obtenerDocumentoCliente(row),
        producto: this.obtenerDescripcionItem(row),
        cantidad: this.obtenerCantidadItem(row),
        precio: this.obtenerPrecioUnitarioItem(row),
        subtotal: this.calcularVentaRow(row),
        precio_unitario: this.obtenerPrecioUnitarioItem(row),
        subtotal_producto: this.calcularVentaRow(row),
      });

      agg.set(key, actual);
    }

    const resultado = Array.from(agg.values())
      .map((item) => ({
        ...item,
        productos: item.productos.sort((a, b) =>
          String(a?.producto ?? '').localeCompare(String(b?.producto ?? ''), 'es', {
            sensitivity: 'base',
            numeric: true,
          }),
        ),
      }))
      .sort((a, b) =>
        String(a?.cliente ?? '').localeCompare(String(b?.cliente ?? ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      );

    const maxItems = Math.max(1, ...resultado.map((c) => Number(c.cantidadTotal) || 0));
    return resultado.map((item) => ({
      ...item,
      progressItems: Math.max(8, Math.round(((Number(item.cantidadTotal) || 0) / maxItems) * 100)),
    }));
  }

  protected extraerCodigoDesdeTexto(valor: unknown): string {
    const raw = String(valor ?? '').trim();
    if (!raw) return '';

    const match = raw.match(/^\s*(\d+)/);
    if (match?.[1]) {
      return this.normalizarCodigoVendedor(match[1]);
    }

    return this.normalizarCodigoVendedor(raw);
  }

  protected obtenerCodigoVendedorDetalle(row: any): string {
    return this.normalizarCodigoVendedor(
      row?.codVendedor ??
        row?.codigo_vendedor ??
        row?.codigoVendedor ??
        row?.vendedor_codigo ??
        row?.cod_vendedor ??
        row?.codigo ??
        '',
    );
  }

  protected obtenerNombreVendedorDetalle(row: any): string {
    const nombre =
      row?.nombreVendedor ??
      row?.vendedor ??
      row?.nomVendedor ??
      row?.nombre_vendedor ??
      row?.nom_vendedor ??
      row?.vendedorNombre ??
      '';

    return this.repararTextoCiudad(String(nombre).trim());
  }

  protected construirDetalleClientesPorVendedor(rows: any[]): any[] {
    const grupos = new Map<
      string,
      {
        key: string;
        codVendedor: string;
        vendedor: string;
        iniciales: string;
        cantidadClientes: number;
        ventaAcum: number;
        expandido: boolean;
        clientes: any[];
      }
    >();

    for (const row of Array.isArray(rows) ? rows : []) {
      const codVendedor = this.obtenerCodigoVendedorDetalle(row);
      const nombreVendedor = this.obtenerNombreVendedorDetalle(row);

      if (!codVendedor && !nombreVendedor) continue;

      const vendedor = nombreVendedor || `Vendedor ${codVendedor}`;
      const key = codVendedor || vendedor;

      if (!grupos.has(key)) {
        grupos.set(key, {
          key,
          codVendedor,
          vendedor,
          iniciales: this.obtenerInicialesCliente(vendedor),
          cantidadClientes: 0,
          ventaAcum: 0,
          expandido: false,
          clientes: [],
        });
      }
    }

    for (const [key, grupo] of grupos.entries()) {
      const filasGrupo = rows.filter((row: any) => {
        const codigo = this.obtenerCodigoVendedorDetalle(row);
        const nombre = this.obtenerNombreVendedorDetalle(row);

        return (
          (grupo.codVendedor && codigo === grupo.codVendedor) ||
          (!grupo.codVendedor && nombre === grupo.vendedor) ||
          key === (codigo || nombre)
        );
      });

      const clientes = this.construirDetalleClientes(filasGrupo);
      grupo.clientes = clientes;
      grupo.cantidadClientes = clientes.length;
      grupo.ventaAcum = clientes.reduce(
        (sum: number, cliente: any) => sum + (Number(cliente?.ventaAcum ?? 0) || 0),
        0,
      );
    }

    return Array.from(grupos.values()).sort((a, b) =>
      String(a?.vendedor ?? '').localeCompare(String(b?.vendedor ?? ''), 'es', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }

  protected limpiarDetalleClientesAdmin(): void {
    this.clientesAgrupados = [];
    this.clientesVista = [];
    this.totalClientesFiltrados = 0;
    this.tableData = [];
    this.chartData = [];
    this.totalTopClientes = 0;
    this.cargandoClientes = false;
    this.errorClientesMsg = '';
    this.cdr.markForCheck();
  }

  protected obtenerCodigoVendedorCatalogo(vendedor: any): string {
    return this.normalizarCodigoVendedor(
      vendedor?.codVendedor ??
        vendedor?.codigo_vendedor ??
        vendedor?.codigoVendedor ??
        vendedor?.codigo ??
        vendedor?.cod ??
        '',
    );
  }

  protected obtenerNombreVendedorCatalogo(vendedor: any): string {
    return this.repararTextoCiudad(
      String(
        vendedor?.nombre ??
          vendedor?.nom_vendedor ??
          vendedor?.nomVendedor ??
          vendedor?.nombreVendedor ??
          vendedor?.vendedor ??
          '',
      ).trim(),
    );
  }

  protected enriquecerDetalleConVendedor(row: any, vendedor: any): any {
    const codVendedor = this.obtenerCodigoVendedorCatalogo(vendedor);
    const nombreVendedor = this.obtenerNombreVendedorCatalogo(vendedor);

    return {
      ...row,
      codVendedor:
        row?.codVendedor ??
        row?.codigo_vendedor ??
        row?.codigoVendedor ??
        row?.vendedor_codigo ??
        codVendedor,
      codigo_vendedor:
        row?.codigo_vendedor ??
        row?.codVendedor ??
        row?.codigoVendedor ??
        row?.vendedor_codigo ??
        codVendedor,
      codigoVendedor:
        row?.codigoVendedor ??
        row?.codVendedor ??
        row?.codigo_vendedor ??
        row?.vendedor_codigo ??
        codVendedor,
      vendedor:
        row?.vendedor ??
        row?.nombreVendedor ??
        row?.nomVendedor ??
        row?.nombre_vendedor ??
        nombreVendedor,
      nombreVendedor:
        row?.nombreVendedor ??
        row?.vendedor ??
        row?.nomVendedor ??
        row?.nombre_vendedor ??
        nombreVendedor,
      nomVendedor: row?.nomVendedor ?? row?.nombreVendedor ?? row?.vendedor ?? nombreVendedor,
    };
  }

  protected pintarDetalleClientesAdmin(listado: any[]): void {
    const detallePorVendedor = this.construirDetalleClientesPorVendedor(listado);

    const topVendedores = [...detallePorVendedor]
      .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 15);

    this.totalTopClientes = topVendedores.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    this.clientesAgrupados = detallePorVendedor;
    this.clientesVisibles = this.clientesPageSize;
    this.actualizarClientesVista();
    this.tableData = detallePorVendedor;
    this.chartData = topVendedores.map((vendedor: any) => ({
      name: vendedor.vendedor || vendedor.codVendedor || 'Vendedor',
      value: Number(vendedor?.ventaAcum ?? 0) || 0,
    }));

    this.chartId = 'chart-clientes-admin-' + Date.now();
    this.cargandoClientes = false;
    this.cdr.markForCheck();
  }

  protected obtenerVendedoresDesdeEndpointConItems(res: any): any[] {
    if (Array.isArray(res)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: array directo', {
        count: res.length,
      });
      return res;
    }
    if (Array.isArray(res?.vendedores)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .vendedores', {
        count: res.vendedores.length,
      });
      return res.vendedores;
    }
    if (Array.isArray(res?.data?.vendedores)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .data.vendedores', {
        count: res.data.vendedores.length,
      });
      return res.data.vendedores;
    }
    if (Array.isArray(res?.data?.rows)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .data.rows', {
        count: res.data.rows.length,
      });
      return res.data.rows;
    }
    if (Array.isArray(res?.rows)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .rows', {
        count: res.rows.length,
      });
      return res.rows;
    }
    if (Array.isArray(res?.data)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .data', {
        count: res.data.length,
      });
      return res.data;
    }
    if (Array.isArray(res?.detalle)) {
      console.debug('✓ [obtenerVendedoresDesdeEndpointConItems] Formato: .detalle', {
        count: res.detalle.length,
      });
      return res.detalle;
    }
    console.error(
      '❌ [obtenerVendedoresDesdeEndpointConItems] No se pudo extraer vendedores en ningún formato',
      {
        respuestaKeys: Object.keys(res ?? {}),
        esArray: Array.isArray(res),
        respuesta: res,
      },
    );
    return [];
  }

  protected obtenerClientesDesdeVendedor(vendedor: any): any[] {
    const clientes = vendedor?.clientes;
    if (Array.isArray(clientes)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: array directo', {
        count: clientes.length,
      });
      return clientes;
    }
    if (Array.isArray(clientes?.data)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: .data', {
        count: clientes.data.length,
      });
      return clientes.data;
    }
    if (Array.isArray(clientes?.rows)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: .rows', {
        count: clientes.rows.length,
      });
      return clientes.rows;
    }
    if (Array.isArray(clientes?.detalle)) {
      console.debug('📋 [obtenerClientesDesdeVendedor] Formato: .detalle', {
        count: clientes.detalle.length,
      });
      return clientes.detalle;
    }
    console.warn('⚠️ [obtenerClientesDesdeVendedor] No se pudo extraer clientes', { vendedor });
    return [];
  }

  protected obtenerItemsDesdeCliente(cliente: any): any[] {
    const items = cliente?.items;
    if (Array.isArray(items)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: array directo', {
        count: items.length,
      });
      return items;
    }
    if (Array.isArray(items?.data)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: .data', { count: items.data.length });
      return items.data;
    }
    if (Array.isArray(items?.rows)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: .rows', { count: items.rows.length });
      return items.rows;
    }
    if (Array.isArray(items?.detalle)) {
      console.debug('🛍️ [obtenerItemsDesdeCliente] Formato: .detalle', {
        count: items.detalle.length,
      });
      return items.detalle;
    }
    console.warn('⚠️ [obtenerItemsDesdeCliente] No se pudo extraer items', { cliente });
    return [];
  }

  protected normalizarPaginacionCliente(valor: any): any {
    if (!valor || typeof valor !== 'object') return null;

    return {
      page: Number(valor?.page ?? valor?.pagina ?? 1) || 1,
      limit: Number(valor?.limit ?? valor?.limite ?? 0) || 0,
      total: Number(valor?.total ?? valor?.count ?? 0) || 0,
    };
  }

  protected normalizarSubtotalItemEndpoint(item: any): number {
    const valor =
      item?.subtotal_producto ??
      item?.subtotalProducto ??
      item?.Subtotal ??
      item?.subtotal ??
      item?.valorTotal ??
      item?.total ??
      0;

    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  protected normalizarCantidadItemEndpoint(item: any): number {
    const valor =
      item?.cantidadTotal ??
      item?.cantidad_total ??
      item?.cantidad ??
      item?.Cantidad ??
      item?.veces ??
      0;

    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  protected obtenerTotalComprasClienteEndpoint(cliente: any): number {
    const valor =
      cliente?.totalCompras ??
      cliente?.total_compras ??
      cliente?.ventaAcum ??
      cliente?.subtotal_total ??
      cliente?.subtotal ??
      cliente?.total ??
      0;

    const num = Number(valor);
    return Number.isFinite(num) ? num : 0;
  }

  protected vendedorCoincideConFiltro(vendedor: any, vendedoresFiltro: string[]): boolean {
    if (!vendedoresFiltro || vendedoresFiltro.length === 0) return true;

    const valores = [
      vendedor?.codVendedor,
      vendedor?.codigo_vendedor,
      vendedor?.codigoVendedor,
      vendedor?.codigo,
      vendedor?.cod,
      vendedor?.id_vendedor,
      vendedor?.idVendedor,
      vendedor?.id,
    ]
      .map((valor) => this.normalizarCodigoVendedor(valor))
      .filter(Boolean);

    return vendedoresFiltro.some((filtro) => {
      const filtroNormalizado = this.normalizarCodigoVendedor(filtro);
      const filtroSinCeros = filtroNormalizado.replace(/^0+/, '') || filtroNormalizado;

      return valores.some((valor) => {
        const valorSinCeros = valor.replace(/^0+/, '') || valor;
        return valor === filtroNormalizado || valorSinCeros === filtroSinCeros;
      });
    });
  }

  protected extraerCodigosDesdeTexto(valor: unknown): string[] {
    const raw = String(valor ?? '').trim();
    if (!raw) return [];

    return raw
      .split(',')
      .map((v) => this.extraerCodigoDesdeTexto(v))
      .filter(Boolean);
  }

  protected mapearVendedoresConItemsComprados(res: any, filtrosConsulta: DashboardFilters): any[] {
    const vendedoresFiltro = this.extraerCodigosDesdeTexto(filtrosConsulta?.vendedor);
    const vendedoresRaw = this.obtenerVendedoresDesdeEndpointConItems(res);

    console.debug('📊 [mapearVendedoresConItemsComprados] Datos recibidos:', {
      vendedoresCount: vendedoresRaw.length,
      primerVendedor: vendedoresRaw[0],
      respuestaCompleta: res,
    });

    const vendedores = vendedoresRaw
      .filter((vendedor: any) => this.vendedorCoincideConFiltro(vendedor, vendedoresFiltro))
      .filter((vendedor: any) => {
        if (!this.tieneCodigosVendedoresPermitidos()) return true;

        const codigo = this.obtenerCodigoVendedorCatalogo(vendedor);
        const id = this.normalizarCodigoVendedor(
          vendedor?.id_vendedor ?? vendedor?.idVendedor ?? vendedor?.id,
        );

        return (
          (codigo && this._codigosVendedoresPermitidos.includes(codigo)) ||
          (id && this._codigosVendedoresPermitidos.includes(id))
        );
      });

    return vendedores
      .map((vendedor: any) => {
        const codVendedor = this.obtenerCodigoVendedorCatalogo(vendedor);
        const idVendedor = this.normalizarCodigoVendedor(
          vendedor?.id_vendedor ?? vendedor?.idVendedor ?? vendedor?.id ?? '',
        );
        const codigoMostrar = codVendedor || idVendedor;
        const nombreVendedor =
          this.obtenerNombreVendedorCatalogo(vendedor) || `Vendedor ${codigoMostrar}`;
        const clientesRaw = this.obtenerClientesDesdeVendedor(vendedor);

        console.debug('👤 [Vendedor]', {
          nombre: nombreVendedor,
          clientesCount: clientesRaw.length,
          clienteExample: clientesRaw[0],
        });

        const clientes = clientesRaw
          .map((cliente: any) => {
            const itemsRaw = this.obtenerItemsDesdeCliente(cliente);
            const clienteNombre = this.repararTextoCiudad(
              String(
                cliente?.razon_social ??
                  cliente?.cliente ??
                  cliente?.nombreCliente ??
                  cliente?.nombre ??
                  '',
              ).trim(),
            );

            if (!clienteNombre) return null;

            const key = String(
              cliente?.id_cliente ??
                cliente?.idCliente ??
                cliente?.nro_documento ??
                cliente?.documento ??
                clienteNombre,
            ).trim();

            console.debug('🏪 [Cliente]', {
              nombre: clienteNombre,
              itemsCount: itemsRaw.length,
              itemExample: itemsRaw[0],
            });

            const productos = itemsRaw.map((item: any) => {
              const cantidad = this.normalizarCantidadItemEndpoint(item);
              const subtotal = this.normalizarSubtotalItemEndpoint(item);

              const productoMapeado = {
                id_item:
                  String(
                    item?.codigo_item ?? item?.codigoItem ?? item?.id_item ?? item?.idItem ?? '',
                  ).trim() || '—',
                fecha: String(item?.fecha ?? item?.ultima_venta ?? item?.ultimaVenta ?? '—'),
                numero_documento: String(
                  cliente?.nro_documento ?? cliente?.numero_documento ?? cliente?.documento ?? '—',
                ),
                producto: this.repararTextoCiudad(
                  String(
                    item?.descripcion ?? item?.producto ?? item?.Descripcion ?? 'Sin descripción',
                  ).trim(),
                ),
                cantidad,
                precio:
                  Number(
                    item?.precio_promedio_ponderado ??
                      item?.precioPromedioPonderado ??
                      item?.precio_unitario ??
                      0,
                  ) || 0,
                subtotal,
                precio_unitario:
                  Number(
                    item?.precio_promedio_ponderado ??
                      item?.precioPromedioPonderado ??
                      item?.precio_unitario ??
                      0,
                  ) || 0,
                subtotal_producto: subtotal,
              };

              console.debug('📦 [Producto mapeado]', productoMapeado);

              return productoMapeado;
            });

            const cantidadTotal = productos.reduce(
              (sum: number, item: any) => sum + (Number(item?.cantidad ?? 0) || 0),
              0,
            );
            const subtotalTotal = productos.reduce(
              (sum: number, item: any) =>
                sum + (Number(item?.subtotal ?? item?.subtotal_producto ?? 0) || 0),
              0,
            );
            const totalCompras = this.obtenerTotalComprasClienteEndpoint(cliente);
            const ultimaCompra = String(
              cliente?.ultimaCompra ??
                cliente?.ultima_compra ??
                cliente?.ultima_venta ??
                cliente?.fecha ??
                '',
            ).trim();

            return {
              key,
              idClienteSucursal: key,
              documento: String(
                cliente?.nro_documento ?? cliente?.numero_documento ?? cliente?.documento ?? '—',
              ),
              cliente: clienteNombre,
              sucursal: this.repararTextoCiudad(
                String(cliente?.sucursal ?? cliente?.sede ?? 'Sin sucursal'),
              ),
              cantidadItems: productos.length,
              cantidadTotal,
              ventaAcum: subtotalTotal,
              totalCompras,
              subtotalTotal,
              expandido: false,
              ultimaCompra,
              ultimaCompraLabel: ultimaCompra
                ? this.formatearFechaCorta(ultimaCompra)
                : 'Sin fecha',
              iniciales: this.obtenerInicialesCliente(clienteNombre),
              progressItems: 0,
              paginacionItems: this.normalizarPaginacionCliente(cliente?.paginacionItems),
              productos: productos.sort((a: any, b: any) =>
                String(a?.producto ?? '').localeCompare(String(b?.producto ?? ''), 'es', {
                  sensitivity: 'base',
                  numeric: true,
                }),
              ),
            };
          })
          .filter(Boolean);

        const maxItems = Math.max(
          1,
          ...clientes.map((cliente: any) => Number(cliente?.cantidadTotal ?? 0) || 0),
        );
        const clientesConProgreso = clientes.map((cliente: any) => ({
          ...cliente,
          progressItems: Math.max(
            8,
            Math.round(((Number(cliente.cantidadTotal) || 0) / maxItems) * 100),
          ),
        }));

        return {
          key: codigoMostrar || nombreVendedor,
          codVendedor: codigoMostrar,
          vendedor: nombreVendedor,
          iniciales: this.obtenerInicialesCliente(nombreVendedor),
          cantidadClientes: clientesConProgreso.length,
          ventaAcum: clientesConProgreso.reduce(
            (sum: number, cliente: any) =>
              sum + (Number(cliente?.subtotalTotal ?? cliente?.ventaAcum ?? 0) || 0),
            0,
          ),
          expandido: false,
          paginacionClientes: this.normalizarPaginacionCliente(vendedor?.paginacionClientes),
          clientes: clientesConProgreso.sort((a: any, b: any) =>
            String(a?.cliente ?? '').localeCompare(String(b?.cliente ?? ''), 'es', {
              sensitivity: 'base',
              numeric: true,
            }),
          ),
        };
      })
      .filter((vendedor: any) => vendedor.cantidadClientes > 0)
      .sort((a: any, b: any) =>
        String(a?.vendedor ?? '').localeCompare(String(b?.vendedor ?? ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      );
  }

  protected pintarDetalleClientesAdminDesdeEndpointConItems(
    res: any,
    filtrosConsulta: DashboardFilters,
  ): void {
    const detallePorVendedor = this.mapearVendedoresConItemsComprados(res, filtrosConsulta);

    const paginacion =
      res?.data?.paginacionVendedores ??
      res?.paginacionVendedores ??
      null;
    if (paginacion) {
      this.paginacionVendedores = {
        page: Number(paginacion?.page ?? 1) || 1,
        limit: Number(paginacion?.limit ?? 0) || 0,
        total: Number(paginacion?.total ?? 0) || 0,
      };
    }

    detallePorVendedor.forEach((grupo: any) => {
      const key = String(grupo?.key ?? grupo?.codVendedor ?? grupo?.vendedor ?? '');
      if (!key) return;
      if (grupo?.paginacionClientes) {
        this.paginacionClientesPorVendedor.set(key, grupo.paginacionClientes);
      }
      if (Array.isArray(grupo?.clientes)) {
        grupo.clientes.forEach((cliente: any) => {
          const clienteKey = String(cliente?.key ?? cliente?.idClienteSucursal ?? '');
          if (!clienteKey) return;
          if (cliente?.paginacionItems) {
            this.paginacionItemsPorCliente.set(clienteKey, cliente.paginacionItems);
          }
        });
      }
    });

    if (!detallePorVendedor.length) {
      this.limpiarDetalleClientesAdmin();
      return;
    }

    const topVendedores = [...detallePorVendedor]
      .sort((a: any, b: any) => Number(b?.ventaAcum ?? 0) - Number(a?.ventaAcum ?? 0))
      .slice(0, 15);

    this.totalTopClientes = topVendedores.reduce(
      (sum: number, item: any) => sum + (Number(item?.ventaAcum ?? 0) || 0),
      0,
    );

    // No calcular/asignar totalAcumuladoVendedor aquí: este endpoint pagina
    // vendedores (vendedorItemsPageSize), por lo que sumar solo
    // detallePorVendedor trunca el KPI de la card cuando hay más vendedores
    // que el tamaño de página. El total real (todos los vendedores
    // filtrados, sin paginar) lo trae refrescarCuotaVendedorFiltrado.

    this.clientesAgrupados = detallePorVendedor;
    this.clientesVisibles = detallePorVendedor.length;
    this.actualizarClientesVista();
    this.tableData = detallePorVendedor;
    this.chartData = topVendedores.map((vendedor: any) => ({
      name: vendedor.vendedor || vendedor.codVendedor || 'Vendedor',
      value: Number(vendedor?.ventaAcum ?? 0) || 0,
    }));

    this.chartId = 'chart-clientes-admin-' + Date.now();
    this.cargandoClientes = false;
    this.cargandoMasVendedores = false;
    this.emitirResumenVista();
    this.cdr.markForCheck();
  }

  protected cargarDetalleClientesAdministrador(filtrosConsulta: DashboardFilters): void {
    this.cargandoClientes = true;
    this.errorClientesMsg = '';
    this.clientesAgrupados = [];
    this.clientesVista = [];
    this.totalClientesFiltrados = 0;
    this.tableData = [];
    this.chartData = [];
    this.vendedoresPageActual = 1;
    this.paginacionVendedores = null;
    this.paginacionClientesPorVendedor = new Map();
    this.paginacionItemsPorCliente = new Map();
    this.cdr.markForCheck();

    const endpointLabel = '/vendedor/con-items-comprados';

    // v1.4.1: el endpoint unificado solo pagina vendedores; clientes e items
    // se devuelven completos. No se envian clientesPage/clientesLimit/itemsPage/itemsLimit.
    const paramsPaginacion = {
      vendedoresPage: this.vendedoresPageActual,
      vendedoresLimit: this.vendedorItemsPageSize,
    };

    const detalleClientes$ = this.cumplimientoService.getVendedoresConItemsComprados(
      filtrosConsulta,
      paramsPaginacion,
    );

    detalleClientes$
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe({
        next: (res: any) => {
          if (res?.data?._error) {
            const errorMsg = res.data._errorMessage || 'Error al cargar los datos';
            console.error('❌ Error cargando detalle de clientes:', errorMsg);
            this.errorClientesMsg = errorMsg;
            this.limpiarDetalleClientesAdmin();
            this.tableData = [];
            this.chartData = [];
            this.cargandoClientes = false;
            this.cdr.markForCheck();
            return;
          }

          this.pintarDetalleClientesAdminDesdeEndpointConItems(res, filtrosConsulta);
        },
        error: (error) => {
          console.error(`Error cargando ${endpointLabel}:`, error);
          this.errorClientesMsg = 'Error al cargar los datos. Intenta más tarde.';
          this.limpiarDetalleClientesAdmin();
          this.cargandoClientes = false;
          this.cdr.markForCheck();
        },
      });
  }

  cargarMasVendedores(): void {
    if (this.cargandoMasVendedores || !this.puedeCargarMasVendedores()) return;
    if (this.rolId === RoleId.VENDEDOR) return;

    this.cargandoMasVendedores = true;
    this.vendedoresPageActual += 1;
    this.cdr.markForCheck();

    const filtrosActivos = this.obtenerFiltrosActivos();
    const paramsPaginacion = {
      vendedoresPage: this.vendedoresPageActual,
      vendedoresLimit: this.vendedorItemsPageSize,
    };

    const detalleClientes$ = this.cumplimientoService.getVendedoresConItemsComprados(
      filtrosActivos,
      paramsPaginacion,
    );

    detalleClientes$.pipe(takeUntil(merge(this.destroy$, this.recargarVista$))).subscribe({
      next: (res: any) => {
        if (res?.data?._error) {
          this.cargandoMasVendedores = false;
          this.vendedoresPageActual = Math.max(1, this.vendedoresPageActual - 1);
          this.cdr.markForCheck();
          return;
        }

        const nuevos = this.mapearVendedoresConItemsComprados(res, filtrosActivos);
        nuevos.forEach((grupo: any) => {
          const key = String(grupo?.key ?? grupo?.codVendedor ?? grupo?.vendedor ?? '');
          if (key && grupo?.paginacionClientes) {
            this.paginacionClientesPorVendedor.set(key, grupo.paginacionClientes);
          }
        });

        const pag =
          res?.data?.paginacionVendedores ??
          res?.paginacionVendedores ??
          null;
        if (pag) {
          this.paginacionVendedores = {
            page: Number(pag?.page ?? 1) || 1,
            limit: Number(pag?.limit ?? 0) || 0,
            total: Number(pag?.total ?? 0) || 0,
          };
        }

        this.clientesAgrupados = [...this.clientesAgrupados, ...nuevos];
        this.clientesVisibles = this.clientesAgrupados.length;
        this.actualizarClientesVista();
        this.tableData = this.clientesAgrupados;
        this.cargandoMasVendedores = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cargandoMasVendedores = false;
        this.vendedoresPageActual = Math.max(1, this.vendedoresPageActual - 1);
        this.cdr.markForCheck();
      },
    });
  }

  puedeCargarMasVendedores(): boolean {
    const pag = this.paginacionVendedores;
    if (!pag) return false;
    return pag.page * pag.limit < pag.total;
  }

  cargarMasClientesDeVendedor(vendedor: any): void {
    if (!vendedor) return;
    const key = String(vendedor?.key ?? vendedor?.codVendedor ?? '');
    if (!key) return;
    if (this.cargandoMasClientesPorVendedor.has(key)) return;

    // v1.4.1: el endpoint unificado devuelve los clientes completos en la
    // primera peticion, no se soporta paginacion anidada de clientes.
    if (this.cargandoMasClientesPorVendedor.has(key)) return;
    this.cargandoMasClientesPorVendedor.add(key);
    this.cdr.markForCheck();
    queueMicrotask(() => {
      this.cargandoMasClientesPorVendedor.delete(key);
      this.cdr.markForCheck();
    });
  }

  cargarMasItemsDeCliente(cliente: any, _vendedorKey: string): void {
    if (!cliente) return;
    const clienteKey = String(cliente?.key ?? cliente?.idClienteSucursal ?? '');
    if (!clienteKey) return;
    if (this.cargandoMasItemsPorCliente.has(clienteKey)) return;

    // v1.4.1: el endpoint unificado devuelve los items completos por cliente,
    // no se soporta paginacion anidada de items.
    this.cargandoMasItemsPorCliente.add(clienteKey);
    this.cdr.markForCheck();
    queueMicrotask(() => {
      this.cargandoMasItemsPorCliente.delete(clienteKey);
      this.cdr.markForCheck();
    });
  }

  puedeCargarMasClientes(vendedor: any): boolean {
    const key = String(vendedor?.key ?? vendedor?.codVendedor ?? '');
    if (!key) return false;
    const pag = this.paginacionClientesPorVendedor.get(key);
    if (!pag) return false;
    return pag.page * pag.limit < pag.total;
  }

  puedeCargarMasItems(cliente: any): boolean {
    const key = String(cliente?.key ?? cliente?.idClienteSucursal ?? '');
    if (!key) return false;
    const pag = this.paginacionItemsPorCliente.get(key);
    if (!pag) return false;
    return pag.page * pag.limit < pag.total;
  }

  cargandoClientesPara(vendedor: any): boolean {
    const key = String(vendedor?.key ?? vendedor?.codVendedor ?? '');
    return this.cargandoMasClientesPorVendedor.has(key);
  }

  cargandoItemsPara(cliente: any): boolean {
    const key = String(cliente?.key ?? cliente?.idClienteSucursal ?? '');
    return this.cargandoMasItemsPorCliente.has(key);
  }

  obtenerFiltrosActivos(): DashboardFilters {
    return { ...this.filtros };
  }

  private mapearClienteConProductos(clienteRaw: any, vendedor: any): any {
    const key = String(clienteRaw?.id_cliente ?? clienteRaw?.idCliente ?? '');
    const clienteNombre = this.repararTextoCiudad(
      String(clienteRaw?.razon_social ?? 'Sin cliente'),
    );
    const productos = this.obtenerItemsDesdeCliente(clienteRaw).map((it: any) =>
      this.mapearItemProducto(it, clienteRaw),
    );
    const cantidadTotal = productos.reduce(
      (s: number, i: any) => s + (Number(i?.cantidad ?? 0) || 0),
      0,
    );
    const subtotalTotal = productos.reduce(
      (s: number, i: any) => s + (Number(i?.subtotal ?? i?.subtotal_producto ?? 0) || 0),
      0,
    );
    const totalCompras = this.obtenerTotalComprasClienteEndpoint(clienteRaw);
    const ultimaCompra = String(
      clienteRaw?.ultimaCompra ??
        clienteRaw?.ultima_compra ??
        clienteRaw?.ultima_venta ??
        clienteRaw?.fecha ??
        '',
    ).trim();

    return {
      key,
      idClienteSucursal: key,
      documento: String(
        clienteRaw?.nro_documento ?? clienteRaw?.numero_documento ?? clienteRaw?.documento ?? '—',
      ),
      cliente: clienteNombre,
      sucursal: this.repararTextoCiudad(
        String(clienteRaw?.sucursal ?? clienteRaw?.sede ?? 'Sin sucursal'),
      ),
      cantidadItems: productos.length,
      cantidadTotal,
      ventaAcum: subtotalTotal,
      totalCompras,
      subtotalTotal,
      expandido: false,
      ultimaCompra,
      ultimaCompraLabel: ultimaCompra ? this.formatearFechaCorta(ultimaCompra) : 'Sin fecha',
      iniciales: this.obtenerInicialesCliente(clienteNombre),
      progressItems: 0,
      paginacionItems: this.normalizarPaginacionCliente(clienteRaw?.paginacionItems),
      productos: productos.sort((a: any, b: any) =>
        String(a?.producto ?? '').localeCompare(String(b?.producto ?? ''), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      ),
    };
  }

  private mapearItemProducto(item: any, cliente: any): any {
    const cantidad = this.normalizarCantidadItemEndpoint(item);
    const subtotal = this.normalizarSubtotalItemEndpoint(item);
    return {
      id_item:
        String(
          item?.codigo_item ?? item?.codigoItem ?? item?.id_item ?? item?.idItem ?? '',
        ).trim() || '—',
      fecha: String(item?.fecha ?? item?.ultima_venta ?? item?.ultimaVenta ?? '—'),
      numero_documento: String(cliente?.nro_documento ?? cliente?.numero_documento ?? cliente?.documento ?? '—'),
      producto: this.repararTextoCiudad(
        String(item?.descripcion ?? item?.producto ?? item?.Descripcion ?? 'Sin descripción').trim(),
      ),
      cantidad,
      precio: Number(item?.precio_promedio_ponderado ?? item?.precioPromedioPonderado ?? item?.precio_unitario ?? 0) || 0,
      subtotal,
      precio_unitario: Number(item?.precio_promedio_ponderado ?? item?.precioPromedioPonderado ?? item?.precio_unitario ?? 0) || 0,
      subtotal_producto: subtotal,
    };
  }

  protected esAgrupacionPorVendedor(): boolean {
    return this.activeVentasView === 'cliente' && this.rolId !== 3;
  }

  get agrupaClientesPorVendedor(): boolean {
    return this.esAgrupacionPorVendedor();
  }

  protected normalizarBusquedaCliente(valor: unknown): string {
    return String(valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  protected actualizarClientesVista(): void {
    const term = this.normalizarBusquedaCliente(this.clienteBusqueda);
    const filtrados = this.esAgrupacionPorVendedor()
      ? this.clientesAgrupados
          .map((grupo) => {
            const vendedorMatch = this.normalizarBusquedaCliente(grupo?.vendedor).includes(term);
            const clientes = Array.isArray(grupo?.clientes) ? grupo.clientes : [];
            const clientesFiltrados = term
              ? clientes.filter(
                  (cliente: any) =>
                    this.normalizarBusquedaCliente(cliente?.cliente).includes(term) ||
                    this.normalizarBusquedaCliente(cliente?.sucursal).includes(term),
                )
              : clientes;

            if (term && !vendedorMatch && clientesFiltrados.length === 0) {
              return null;
            }

            return {
              ...grupo,
              clientes: term ? clientesFiltrados : clientes,
            };
          })
          .filter(Boolean)
      : term
        ? this.clientesAgrupados.filter((c) =>
            this.normalizarBusquedaCliente(c?.cliente).includes(term),
          )
        : this.clientesAgrupados;

    this.totalClientesFiltrados = filtrados.length;
    
    // Para administrador: mostrar todos los clientes sin límite de paginación
    // Para otros roles: aplicar paginación normal
    const esAdmin = this.rolId === RoleId.ADMINISTRADOR;
    this.clientesVisibles = this.esAgrupacionPorVendedor() || esAdmin
      ? filtrados.length
      : this.clientesVisibles;
    this.clientesVista = filtrados.slice(0, this.clientesVisibles);
  }

  get etiquetaClientesVista(): string {
    return this.esAgrupacionPorVendedor() ? 'vendedores' : 'clientes';
  }

  get placeholderBusquedaClientes(): string {
    return this.esAgrupacionPorVendedor()
      ? 'Buscar vendedor o cliente'
      : 'Buscar cliente por nombre';
  }

  get tituloListaClientes(): string {
    return this.esAgrupacionPorVendedor() ? 'Vendedores con detalle por cliente' : 'Clientes';
  }

  get tituloTopClientes(): string {
    return this.esAgrupacionPorVendedor() ? 'Top 15 Vendedores' : 'Top 15 Clientes';
  }

  onBuscarClienteChange(valor: string): void {
    this.clienteBusqueda = valor;
    
    // Para administrador: mostrar todos los clientes sin límite de paginación
    const esAdmin = this.rolId === RoleId.ADMINISTRADOR;
    this.clientesVisibles = this.esAgrupacionPorVendedor() || esAdmin
      ? this.clientesAgrupados.length
      : this.clientesPageSize;
    this.actualizarClientesVista();
    this.cdr.markForCheck();
  }

  get hayMasClientes(): boolean {
    return this.puedeCargarMasVendedores();
  }

  verMasClientes(): void {
    this.cargarMasVendedores();
  }

  protected getLimiteProductosCliente(key: string): number {
    const esAdmin = this.rolId === RoleId.ADMINISTRADOR;
    
    // Para administrador o agrupación por vendedor: mostrar todos los productos sin límite
    if (this.esAgrupacionPorVendedor() || esAdmin) {
      return Number.MAX_SAFE_INTEGER;
    }

    return this.productosVisiblesPorCliente[key] ?? this.productosPageSize;
  }

  get totalCuotaCategoriaLabel(): string {
    return this.formatearMoneda(this.totalCuotaCategoria);
  }

  get totalAcumuladoCategoriaLabel(): string {
    return this.formatearMoneda(this.totalAcumuladoCategoria);
  }

  get totalTopCategoriasLabel(): string {
    return this.formatearMoneda(this.totalTopCategorias);
  }

  get totalTopProveedoresLabel(): string {
    return this.formatearMoneda(this.totalTopProveedores);
  }

  get totalTopVendedoresLabel(): string {
    return this.formatearMoneda(this.totalTopVendedores);
  }

  get totalCuotaProveedorLabel(): string {
    return this.formatearMoneda(this.totalCuotaProveedor);
  }

  get totalAcumuladoProveedorLabel(): string {
    return this.formatearMoneda(this.totalAcumuladoProveedor);
  }

  get totalTopClientesLabel(): string {
    return this.formatearMoneda(this.totalTopClientes);
  }

  get totalTopClientesTitulo(): string {
    return this.tituloTopClientes;
  }

  get totalTopItemsSubtotalLabel(): string {
    return this.formatearMoneda(this.totalTopItemsSubtotal);
  }

  get totalTopCiudadesLabel(): string {
    return this.formatearMoneda(this.totalTopCiudades);
  }

  get totalAcumuladoCiudadLabel(): string {
    return this.formatearMoneda(this.totalAcumuladoCiudad);
  }

  get totalCuotaVendedorLabel(): string {
    return this.formatearMoneda(this.totalCuotaVendedor);
  }

  get totalAcumuladoVendedorLabel(): string {
    return this.formatearMoneda(this.totalAcumuladoVendedor);
  }

  get totalCuotaCiudadLabel(): string {
    return this.formatearMoneda(this.totalCuotaCiudad);
  }

  get totalCuotaDiariaLabel(): string {
    return this.formatearMoneda(this.totalCuotaDiaria);
  }

  get totalTopProveedoresCompactoLabel(): string {
    return this.formatearMonedaCompacta(this.totalTopProveedores);
  }

  verMasProductos(cliente: any): void {
    if (!cliente) return;
    const clienteKey = String(cliente?.key ?? cliente?.idClienteSucursal ?? '');
    if (!clienteKey) return;
    const vendedorGrupo = this.clientesAgrupados.find((v: any) =>
      Array.isArray(v?.clientes) && v.clientes.some(
        (c: any) => String(c?.key ?? c?.idClienteSucursal ?? '') === clienteKey,
      ),
    );
    const vendedorKey = String(vendedorGrupo?.key ?? vendedorGrupo?.codVendedor ?? '');
    this.cargarMasItemsDeCliente(cliente, vendedorKey);
  }

  toggleCliente(cliente: any): void {
    const esClienteAnidado = this.esAgrupacionPorVendedor() && Array.isArray(cliente?.productos);

    if (!esClienteAnidado) {
      for (const c of this.clientesVista) {
        if (c !== cliente) c.expandido = false;
      }
    }

    cliente.expandido = !cliente.expandido;

    const esAdmin = this.rolId === RoleId.ADMINISTRADOR;
    if (cliente.expandido && cliente?.key && !this.productosVisiblesPorCliente[cliente.key]) {
      // Para administrador: mostrar todos los productos sin límite
      this.productosVisiblesPorCliente[cliente.key] = esAdmin
        ? Number.MAX_SAFE_INTEGER
        : this.productosPageSize;
    }

    this.cdr.markForCheck();
  }
}
