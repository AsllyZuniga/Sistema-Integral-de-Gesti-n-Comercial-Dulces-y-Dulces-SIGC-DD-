import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { VendedorItemsService } from '../../../../core/services/vendedor-items.service';
import { ClienteConItems } from '../../../../core/models/cliente.model';
import { ItemComprado } from '../../../../core/models/item.model';

@Component({
  selector: 'app-cliente-card',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './cliente-card.component.html',
  styleUrls: ['./cliente-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClienteCardComponent {
  private readonly service = inject(VendedorItemsService);

  @Input({ required: true }) cliente!: ClienteConItems;
  @Input({ required: true }) vendedorPage = 1;
  @Input({ required: true }) clientesPage = 1;

  readonly expandido = signal(false);
  readonly itemsPageActual = signal(1);
  readonly itemsLimit = 10;

  readonly items = computed<ItemComprado[]>(() => {
    const id = this.cliente?.id_cliente;
    if (id == null) return [];
    return this.service.itemsPorCliente().get(id) ?? [];
  });

  readonly isLoading = computed(() => this.service.loadingItems() === this.cliente?.id_cliente);

  readonly hasMore = computed(() => {
    const id = this.cliente?.id_cliente;
    if (id == null) return false;
    return this.service.hasMoreItems(id);
  });

  readonly paginacion = computed(() => {
    const id = this.cliente?.id_cliente;
    if (id == null) return null;
    return this.service.pagItemsPorCliente().get(id) ?? null;
  });

  readonly cargandoInicial = computed(
    () => this.expandido() && this.items().length === 0 && this.isLoading(),
  );

  readonly yaCargado = computed(() => this.items().length > 0);

  readonly iniciales = computed(() => this.obtenerIniciales(this.cliente?.razon_social));

  toggle(): void {
    if (!this.cliente) return;
    const nuevoEstado = !this.expandido();
    this.expandido.set(nuevoEstado);

    if (nuevoEstado && !this.yaCargado()) {
      this.itemsPageActual.set(1);
      this.service.loadItemsDeCliente(
        this.vendedorPage,
        this.clientesPage,
        this.cliente.id_cliente,
        1,
        this.itemsLimit,
      );
    }
  }

  cargarMas(): void {
    if (!this.cliente || this.isLoading() || !this.hasMore()) return;
    const siguiente = this.itemsPageActual() + 1;
    this.itemsPageActual.set(siguiente);
    this.service.loadItemsDeCliente(
      this.vendedorPage,
      this.clientesPage,
      this.cliente.id_cliente,
      siguiente,
      this.itemsLimit,
    );
  }

  totalLabel(): string {
    const total = Number(this.cliente?.totalCompras ?? 0);
    return Number.isFinite(total) ? total.toLocaleString('es-CO') : '0';
  }

  cantidadLabel(): string {
    const total = this.paginacion()?.total ?? 0;
    return total.toLocaleString('es-CO');
  }

  private obtenerIniciales(texto: string | undefined | null): string {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return 'CL';
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'CL';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
}
