import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { VendedorItemsService } from '../../../../core/services/vendedor-items.service';
import { VendedorConClientes } from '../../../../core/models/vendedor.model';
import { ClienteConItems } from '../../../../core/models/cliente.model';
import { ClienteCardComponent } from '../cliente-card/cliente-card.component';

@Component({
  selector: 'app-vendedor-card',
  standalone: true,
  imports: [CommonModule, ClienteCardComponent],
  templateUrl: './vendedor-card.component.html',
  styleUrls: ['./vendedor-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendedorCardComponent {
  private readonly service = inject(VendedorItemsService);

  @Input({ required: true }) vendedor!: VendedorConClientes;
  @Input({ required: true }) vendedorPage = 1;

  readonly expandido = signal(false);

  readonly clientes = computed<ClienteConItems[]>(() => {
    const id = this.vendedor?.id_vendedor;
    if (id == null) return [];
    return this.service.clientesPorVendedor().get(id) ?? [];
  });

  readonly yaCargado = computed(() => this.clientes().length > 0);

  readonly iniciales = computed(() => this.obtenerIniciales(this.vendedor?.nombre));

  readonly totalClientes = computed(() => this.clientes().length);

  toggle(): void {
    if (!this.vendedor) return;
    this.expandido.set(!this.expandido());
  }

  private obtenerIniciales(texto: string | undefined | null): string {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return 'VN';
    const partes = limpio.split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'VN';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
  }
}
