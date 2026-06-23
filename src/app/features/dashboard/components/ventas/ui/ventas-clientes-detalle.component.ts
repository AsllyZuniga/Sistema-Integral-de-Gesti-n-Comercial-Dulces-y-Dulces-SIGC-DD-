import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartComponent } from '../../../../../shared/components/chart';
import { TableComponent } from '../../../../../shared/components/table/table.component';

@Component({
  selector: 'app-ventas-clientes-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartComponent, TableComponent],
  template: `
    <div class="stack-layout">
      <div class="filtro-bar filtro-bar-clientes">
        <label class="cliente-search" for="cliente-search-input">
          <span class="cliente-search-icon" aria-hidden="true">search</span>
          <input
            id="cliente-search-input"
            type="text"
            [ngModel]="clienteBusqueda"
            (ngModelChange)="buscarCliente.emit($event)"
            [placeholder]="placeholderBusquedaClientes"
          />
        </label>

        <span class="filtro-badge">
          {{ totalClientesFiltrados }} {{ etiquetaClientesVista }}
        </span>
      </div>

      @if (cargandoClientes) {
        <div class="placeholder">
          {{ agrupaClientesPorVendedor ? 'Cargando vendedores...' : 'Cargando clientes...' }}
        </div>
      } @else if (errorClientesMsg) {
        <div class="placeholder" style="color: #d32f2f; font-weight: 500;">
          ⚠️ {{ errorClientesMsg }}
        </div>
      } @else if (clientesVista.length > 0) {
        <div class="clientes-listado">
          @if (agrupaClientesPorVendedor) {
            @for (vendedor of clientesVista; track vendedor.key) {
              <article class="cliente-card vendedor-card">
                <button
                  class="cliente-head vendedor-head"
                  [class.open]="vendedor.expandido"
                  type="button"
                  (click)="toggleCliente.emit(vendedor)"
                >
                  <div class="vendedor-avatar" aria-hidden="true">{{ vendedor.iniciales }}</div>

                  <div class="cliente-identidad">
                    <h4>{{ vendedor.vendedor }}</h4>
                    <div class="cliente-meta-row">
                      <span class="cliente-meta">Código: {{ vendedor.codVendedor || '—' }}</span>
                      <span class="cliente-total">Total compras {{ getTotalClienteLabel(vendedor) }}</span>
                    </div>
                    <div class="cliente-meta-row">
                      <span class="cliente-meta">Clientes: {{ getTotalClientesVendedorLabel(vendedor) }}</span>
                    </div>
                  </div>

                  <span class="cliente-toggle" [class.open]="vendedor.expandido">›</span>
                </button>

                @if (vendedor.expandido) {
                  <div class="cliente-body tabla-scroll vendedor-body">
                    <div class="vendedor-clientes-listado">
                      @for (cliente of vendedor.clientes; track cliente.key) {
                        <ng-container
                          [ngTemplateOutlet]="clienteCard"
                          [ngTemplateOutletContext]="{ cliente: cliente, vendedor: vendedor }"
                        ></ng-container>
                      }
                    </div>
                  </div>
                }
              </article>
            }
          } @else {
            @for (cliente of clientesVista; track cliente.key) {
              <ng-container
                [ngTemplateOutlet]="clienteCard"
                [ngTemplateOutletContext]="{ cliente: cliente }"
              ></ng-container>
            }
          }
        </div>

        @if (hayMasClientes) {
          <div class="cliente-actions cliente-actions-global">
            <button type="button" class="btn-ver-mas" (click)="verMasClientes.emit()">
              Ver más {{ etiquetaClientesVista }}
            </button>
          </div>
        }
      } @else {
        <div class="placeholder">
          No hay {{ etiquetaClientesVista }} disponibles para los filtros seleccionados
        </div>
      }

      @if (chartData.length > 0) {
        <div class="grafica-container">
          <div class="proveedor-kpis">
            <article class="proveedor-kpi-card">
              <span class="proveedor-kpi-label">Suma Top 15</span>
              <strong class="proveedor-kpi-value">{{ totalTopClientesLabel }}</strong>
            </article>
          </div>

          <h4>{{ totalTopClientesTitulo }}</h4>

          <app-chart
            [chartId]="chartId"
            [data]="chartData"
            [type]="chartType"
            [label]="totalTopClientesTitulo"
          ></app-chart>
        </div>
      }
    </div>

    <ng-template #clienteCard let-cliente="cliente" let-vendedor="vendedor">
      <article class="cliente-card" [class.cliente-card-nested]="agrupaClientesPorVendedor">
        <button class="cliente-head" type="button" (click)="toggleCliente.emit(cliente)">
          <div class="cliente-avatar" aria-hidden="true">{{ cliente.iniciales }}</div>

          <div class="cliente-identidad">
            <h4>{{ cliente.cliente }}</h4>
            <span class="cliente-stats">
              {{ getCantidadItemsClienteLabel(cliente) }} item{{ getCantidadItemsCliente(cliente) !== 1 ? 's' : '' }}
            </span>
            <div class="cliente-meta-row">
              <span class="cliente-total">Total compras {{ getTotalClienteLabel(cliente) }}</span>
            </div>
          </div>

          <span class="cliente-toggle" [class.open]="cliente.expandido">›</span>
        </button>

        @if (cliente.expandido) {
          <div class="cliente-body tabla-scroll">
            <app-table
              [columns]="clienteProductosColumns"
              [data]="getProductosClienteVisibles(cliente)"
            ></app-table>

            @if (tieneMasProductos(cliente)) {
              <div class="cliente-actions">
                <button
                  type="button"
                  class="btn-ver-mas"
                  (click)="verMasProductos.emit(cliente)"
                  [disabled]="cargandoProductosPara(cliente)"
                >
                  @if (cargandoProductosPara(cliente)) {
                    <span>Cargando...</span>
                  } @else {
                    <span>Ver más productos</span>
                  }
                </button>
              </div>
            }
          </div>
        }
      </article>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VentasClientesDetalleComponent {
  @Input() clienteBusqueda = '';
  @Input() totalClientesFiltrados = 0;
  @Input() etiquetaClientesVista = 'clientes';
  @Input() placeholderBusquedaClientes = '';
  @Input() cargandoClientes = false;
  @Input() errorClientesMsg = '';
  @Input() clientesVista: any[] = [];
  @Input() agrupaClientesPorVendedor = false;
  @Input() hayMasClientes = false;
  @Input() clienteProductosColumns: string[] = [];
  @Input() productosVisiblesPorCliente: Record<string, number> = {};
  @Input() productosPageSize = 25;
  @Input() chartId = 'chart-main';
  @Input() chartData: any[] = [];
  @Input() chartType: 'line' | 'bar' | 'pie' = 'line';
  @Input() totalTopClientesLabel = '';
  @Input() totalTopClientesTitulo = '';

  @Output() buscarCliente = new EventEmitter<string>();
  @Output() toggleCliente = new EventEmitter<any>();
  @Output() verMasClientes = new EventEmitter<void>();
  @Output() verMasClientesDeVendedor = new EventEmitter<any>();
  @Output() verMasProductos = new EventEmitter<any>();

  getProductosClienteVisibles(cliente: any): any[] {
    const productos = Array.isArray(cliente?.productos) ? cliente.productos : [];
    if (cliente?.paginacionItems && Number(cliente.paginacionItems.total) > 0) {
      return productos;
    }
    return productos.slice(0, this.getLimiteProductosCliente(cliente?.key));
  }

  getCantidadItemsCliente(cliente: any): number {
    const cantidadItems = Number(cliente?.cantidadItems);
    if (Number.isFinite(cantidadItems) && cantidadItems >= 0) return cantidadItems;

    const cantidadTotal = Number(cliente?.cantidadTotal);
    if (Number.isFinite(cantidadTotal) && cantidadTotal >= 0) return cantidadTotal;

    const productos = Array.isArray(cliente?.productos) ? cliente.productos.length : 0;
    return Number.isFinite(productos) ? productos : 0;
  }

  getCantidadItemsClienteLabel(cliente: any): string {
    return this.getCantidadItemsCliente(cliente).toLocaleString('es-CO');
  }

  getTotalClienteLabel(cliente: any): string {
    const total = Number(
      this.agrupaClientesPorVendedor
        ? cliente?.subtotalTotal ?? cliente?.ventaAcum ?? 0
        : cliente?.totalCompras ?? cliente?.ventaAcum ?? 0,
    );
    return Number.isFinite(total) ? total.toLocaleString('es-CO') : '0';
  }

  getTotalClientesVendedorLabel(vendedor: any): string {
    const total = Number(
      vendedor?.paginacionClientes?.total ?? vendedor?.cantidadClientes ?? 0,
    );
    const totalLabel = Number.isFinite(total) && total > 0
      ? total.toLocaleString('es-CO')
      : '0';
    return `${totalLabel} ${total === 1 ? 'cliente' : 'clientes'}`;
  }

  puedeCargarMasClientesParaVendedor(vendedor: any): boolean {
    if (vendedor?._cargandoMasClientes) return false;
    const pag = vendedor?.paginacionClientes;
    if (!pag || Number(pag?.total ?? 0) === 0) return false;
    const cargados = Array.isArray(vendedor?.clientes) ? vendedor.clientes.length : 0;
    const total = Number(pag.total);
    if (!Number.isFinite(total) || total <= 0) return false;
    return cargados < total;
  }

  tieneMasProductos(cliente: any): boolean {
    const pag = cliente?.paginacionItems;
    if (pag && Number(pag?.total) > 0) {
      const cargados = Array.isArray(cliente?.productos) ? cliente.productos.length : 0;
      return cargados < Number(pag.total);
    }
    const total = cliente?.productos?.length ?? 0;
    return total > this.getLimiteProductosCliente(cliente?.key);
  }

  cargandoClientesParaVendedor(vendedor: any): boolean {
    return !!vendedor?._cargandoMasClientes;
  }

  cargandoProductosPara(cliente: any): boolean {
    return !!cliente?._cargandoMasItems;
  }

  private getLimiteProductosCliente(key: string): number {
    if (this.agrupaClientesPorVendedor) {
      return Number.MAX_SAFE_INTEGER;
    }

    return this.productosVisiblesPorCliente[key] ?? this.productosPageSize;
  }
}
