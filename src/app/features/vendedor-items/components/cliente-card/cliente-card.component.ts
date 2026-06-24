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

  readonly expandido = signal(false);

  readonly items = computed<ItemComprado[]>(() => {
    const id = this.cliente?.id_cliente;
    if (id == null) return [];
    return this.service.itemsPorCliente().get(id) ?? [];
  });

  readonly iniciales = computed(() => this.obtenerIniciales(this.cliente?.razon_social));

  toggle(): void {
    if (!this.cliente) return;
    this.expandido.set(!this.expandido());
  }

  totalLabel(): string {
    const total = Number(this.cliente?.totalCompras ?? 0);
    return Number.isFinite(total) ? total.toLocaleString('es-CO') : '0';
  }

  cantidadLabel(): string {
    return this.items().length.toLocaleString('es-CO');
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
