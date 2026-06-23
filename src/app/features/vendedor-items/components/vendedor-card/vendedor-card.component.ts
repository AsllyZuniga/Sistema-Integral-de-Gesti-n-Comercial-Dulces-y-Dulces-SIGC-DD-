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
  readonly clientesPageActual = signal(1);
  readonly clientesLimit = 50;

  readonly clientes = computed<ClienteConItems[]>(() => {
    const id = this.vendedor?.id_vendedor;
    if (id == null) return [];
    return this.service.clientesPorVendedor().get(id) ?? [];
  });

  readonly isLoading = computed(
    () => this.service.loadingClientes() === this.vendedor?.id_vendedor,
  );

  readonly hasMore = computed(() => {
    const id = this.vendedor?.id_vendedor;
    if (id == null) return false;
    return this.service.hasMoreClientes(id);
  });

  readonly paginacion = computed(() => {
    const id = this.vendedor?.id_vendedor;
    if (id == null) return null;
    return this.service.pagClientesPorVendedor().get(id) ?? null;
  });

  readonly cargandoInicial = computed(
    () => this.expandido() && this.clientes().length === 0 && this.isLoading(),
  );

  readonly yaCargado = computed(() => this.clientes().length > 0);

  readonly iniciales = computed(() => this.obtenerIniciales(this.vendedor?.nombre));

  readonly totalClientes = computed(() => this.paginacion()?.total ?? 0);

  toggle(): void {
    if (!this.vendedor) return;
    const nuevoEstado = !this.expandido();
    this.expandido.set(nuevoEstado);

    if (nuevoEstado && !this.yaCargado()) {
      this.clientesPageActual.set(1);
      this.service.loadClientesDeVendedor(
        this.vendedorPage,
        this.vendedor.id_vendedor,
        1,
        this.clientesLimit,
      );
    }
  }

  cargarMas(): void {
    if (!this.vendedor || this.isLoading() || !this.hasMore()) return;
    const siguiente = this.clientesPageActual() + 1;
    this.clientesPageActual.set(siguiente);
    this.service.loadClientesDeVendedor(
      this.vendedorPage,
      this.vendedor.id_vendedor,
      siguiente,
      this.clientesLimit,
    );
  }

  getClientePage(clienteId: number): number {
    if (!this.vendedor) return 1;
    return this.service.getClientePageEnVendedor(this.vendedor.id_vendedor, clienteId);
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
