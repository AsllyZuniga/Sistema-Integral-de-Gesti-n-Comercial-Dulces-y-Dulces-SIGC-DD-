import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VendedorItemsService } from '../../../../core/services/vendedor-items.service';
import { VendedorCardComponent } from '../../components/vendedor-card/vendedor-card.component';

@Component({
  selector: 'app-vendedor-items-page',
  standalone: true,
  imports: [CommonModule, FormsModule, VendedorCardComponent],
  templateUrl: './vendedor-items-page.component.html',
  styleUrls: ['./vendedor-items-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendedorItemsPageComponent implements OnInit {
  readonly service = inject(VendedorItemsService);

  readonly currentVendedoresPage = signal(1);
  readonly vendedoresLimit = 10;

  readonly fechaInicioInput = signal<string>('');
  readonly fechaFinInput = signal<string>('');

  readonly hasMoreVendedores = computed(() => this.service.hasMoreVendedores());

  readonly totalVendedores = computed(
    () => this.service.pagVendedores()?.total ?? 0,
  );

  readonly cargandoVendedores = computed(() => this.service.loadingVendedores());

  readonly mostrarLista = computed(
    () => this.service.vendedores().length > 0 || this.cargandoVendedores(),
  );

  readonly vendedoresActuales = computed(() => this.service.vendedores());

  readonly errorMsg = computed(() => this.service.error());

  readonly mostrando = computed(() => {
    const pag = this.service.pagVendedores();
    if (!pag) return this.service.vendedores().length;
    return Math.min(pag.page * pag.limit, pag.total);
  });

  readonly tieneFiltros = computed(
    () => !!this.service.fechaInicio() || !!this.service.fechaFin(),
  );

  ngOnInit(): void {
    if (!this.service.firstPageLoaded()) {
      this.service.loadVendedores(1, this.vendedoresLimit);
    }
  }

  cargarMasVendedores(): void {
    if (this.cargandoVendedores() || !this.hasMoreVendedores()) return;
    const siguiente = this.currentVendedoresPage() + 1;
    this.currentVendedoresPage.set(siguiente);
    this.service.loadVendedores(siguiente, this.vendedoresLimit);
  }

  aplicarFiltros(): void {
    const inicio = this.fechaInicioInput() || null;
    const fin = this.fechaFinInput() || null;
    this.currentVendedoresPage.set(1);
    this.service.setFiltroFechas(inicio, fin);
  }

  limpiarFiltros(): void {
    this.fechaInicioInput.set('');
    this.fechaFinInput.set('');
    this.currentVendedoresPage.set(1);
    this.service.setFiltroFechas(null, null);
  }

  reintentar(): void {
    this.service.recargarTodo();
    this.currentVendedoresPage.set(1);
  }

  getVendedorPage(vendedorId: number): number {
    return this.service.getVendedorPage(vendedorId);
  }
}
