import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ItemComprado } from '../models/item.model';
import { ClienteConItems } from '../models/cliente.model';
import { Paginacion } from '../models/paginacion.model';
import { VendedorConClientes } from '../models/vendedor.model';
import { VendedorItemsData, VendedorItemsResponse } from '../models/vendedor-items-response.model';

const REQUEST_TIMEOUT_MS = 30_000;
const ENDPOINT = `${environment.apiUrl}/api/vendedor/con-items-comprados`;

@Injectable({ providedIn: 'root' })
export class VendedorItemsService {
  private readonly http = inject(HttpClient);

  // ───────── Nivel 1: Vendedores ─────────
  readonly vendedores = signal<VendedorConClientes[]>([]);
  readonly pagVendedores = signal<Paginacion | null>(null);
  readonly loadingVendedores = signal(false);
  readonly vendedorPagina = signal<ReadonlyMap<number, number>>(new Map());
  readonly firstPageLoaded = signal(false);

  // ───────── Nivel 2: Clientes por vendedor (completos, no se paginan) ─────────
  readonly clientesPorVendedor = signal<ReadonlyMap<number, ClienteConItems[]>>(new Map());
  readonly pagClientesPorVendedor = signal<ReadonlyMap<number, Paginacion>>(new Map());
  readonly loadingClientes = signal<number | null>(null);

  // ───────── Nivel 3: Items por cliente (completos, no se paginan) ─────────
  readonly itemsPorCliente = signal<ReadonlyMap<number, ItemComprado[]>>(new Map());
  readonly pagItemsPorCliente = signal<ReadonlyMap<number, Paginacion>>(new Map());
  readonly loadingItems = signal<number | null>(null);

  // ───────── Filtros y error ─────────
  readonly fechaInicio = signal<string | null>(null);
  readonly fechaFin = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  // ───────── Generaciones para cancelación ─────────
  private reqVendedoresGen = 0;

  loadVendedores(page = 1, limit = 10): void {
    const myGen = ++this.reqVendedoresGen;
    this.loadingVendedores.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('vendedoresPage', String(page))
      .set('vendedoresLimit', String(limit));

    params = this.aplicarFiltrosFechas(params);

    this.http
      .get<VendedorItemsResponse>(ENDPOINT, { params })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((res) => this.normalizarResponse(res)),
        catchError((err) => of(this.errorFromHttp(err))),
      )
      .subscribe((res) => {
        if (this.reqVendedoresGen !== myGen) return;

        if (!res.success) {
          this.loadingVendedores.set(false);
          this.error.set(res.message || 'No se pudieron obtener los vendedores');
          return;
        }

        const nuevos = res.data.vendedores;
        const pagActual = res.data.paginacionVendedores;

        if (page === 1) {
          this.vendedores.set(nuevos);
          this.vendedorPagina.set(new Map());
        } else {
          this.vendedores.set([...this.vendedores(), ...nuevos]);
        }

        const mapaPaginas = new Map(this.vendedorPagina());
        for (const v of nuevos) {
          mapaPaginas.set(v.id_vendedor, page);
        }
        this.vendedorPagina.set(mapaPaginas);

        this.sincronizarClientesEItemsCompletos(nuevos);

        this.pagVendedores.set(pagActual);
        this.loadingVendedores.set(false);
        this.firstPageLoaded.set(true);
      });
  }

  /**
   * Como el backend ahora devuelve clientes e items completos en cada respuesta,
   * sincronizamos los mapas locales a partir de los vendedores recibidos.
   */
  private sincronizarClientesEItemsCompletos(vendedores: VendedorConClientes[]): void {
    const mapaClientes = new Map<number, ClienteConItems[]>(this.clientesPorVendedor());
    const mapaItems = new Map<number, ItemComprado[]>(this.itemsPorCliente());

    for (const v of vendedores) {
      const idV = Number(v.id_vendedor);
      if (!Number.isFinite(idV)) continue;
      mapaClientes.set(idV, Array.isArray(v.clientes) ? v.clientes : []);
      for (const c of v.clientes ?? []) {
        const idC = Number(c?.id_cliente);
        if (!Number.isFinite(idC)) continue;
        mapaItems.set(idC, Array.isArray(c.items) ? c.items : []);
      }
    }

    this.clientesPorVendedor.set(mapaClientes);
    this.itemsPorCliente.set(mapaItems);
  }

  reset(): void {
    this.vendedores.set([]);
    this.pagVendedores.set(null);
    this.vendedorPagina.set(new Map());
    this.firstPageLoaded.set(false);

    this.clientesPorVendedor.set(new Map());
    this.pagClientesPorVendedor.set(new Map());

    this.itemsPorCliente.set(new Map());
    this.pagItemsPorCliente.set(new Map());

    this.loadingClientes.set(null);
    this.loadingItems.set(null);
    this.error.set(null);

    this.reqVendedoresGen++;
  }

  setFiltroFechas(fechaInicio: string | null, fechaFin: string | null): void {
    this.fechaInicio.set(fechaInicio);
    this.fechaFin.set(fechaFin);
    this.reset();
    this.loadVendedores(1, 10);
  }

  recargarTodo(): void {
    this.reset();
    this.loadVendedores(1, 10);
  }

  getVendedorPage(idVendedor: number): number {
    return this.vendedorPagina().get(idVendedor) ?? 1;
  }

  hasMoreVendedores(): boolean {
    const pag = this.pagVendedores();
    if (!pag) return false;
    return pag.page * pag.limit < pag.total;
  }

  hasMoreClientes(idVendedor: number): boolean {
    const pag = this.pagClientesPorVendedor().get(idVendedor);
    if (!pag) return false;
    return pag.page * pag.limit < pag.total;
  }

  hasMoreItems(idCliente: number): boolean {
    const pag = this.pagItemsPorCliente().get(idCliente);
    if (!pag) return false;
    return pag.page * pag.limit < pag.total;
  }

  private aplicarFiltrosFechas(params: HttpParams): HttpParams {
    const inicio = this.fechaInicio();
    const fin = this.fechaFin();
    let p = params;
    if (inicio) p = p.set('fechaInicio', inicio);
    if (fin) p = p.set('fechaFin', fin);
    return p;
  }

  private normalizarResponse(res: VendedorItemsResponse | null | undefined): VendedorItemsResponse {
    const emptyData: VendedorItemsData = { vendedores: [], paginacionVendedores: null };
    const emptyResponse: VendedorItemsResponse = {
      success: false,
      data: emptyData,
      message: '',
    };
    const safe: VendedorItemsResponse = res ?? emptyResponse;
    const data: VendedorItemsData = safe.data ?? emptyData;
    const vendedores = Array.isArray(data.vendedores) ? data.vendedores : [];
    const paginacionVendedores = data.paginacionVendedores ?? null;

    const vendedoresNormalizados: VendedorConClientes[] = vendedores.map((v) => ({
      id_vendedor: Number(v.id_vendedor),
      codigo_vendedor: String(v.codigo_vendedor ?? ''),
      nombre: String(v.nombre ?? ''),
      clientes: Array.isArray(v.clientes) ? v.clientes : [],
      paginacionClientes: v.paginacionClientes ?? { page: 1, limit: 0, total: 0 },
    }));

    return {
      success: !!safe.success,
      message: String(safe.message ?? ''),
      data: {
        vendedores: vendedoresNormalizados,
        paginacionVendedores,
      },
    };
  }

  private errorFromHttp(err: unknown): VendedorItemsResponse {
    const base: VendedorItemsResponse = {
      success: false,
      data: { vendedores: [], paginacionVendedores: null },
      message: '',
    };
    if (this.isTimeoutError(err)) {
      return {
        ...base,
        message: 'La solicitud tardó demasiado tiempo. Intenta con filtros más específicos.',
      };
    }
    return {
      ...base,
      message: 'No se pudo conectar con el servidor. Intenta nuevamente.',
    };
  }

  private isTimeoutError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const anyErr = err as { name?: string };
    return anyErr.name === 'TimeoutError';
  }
}
