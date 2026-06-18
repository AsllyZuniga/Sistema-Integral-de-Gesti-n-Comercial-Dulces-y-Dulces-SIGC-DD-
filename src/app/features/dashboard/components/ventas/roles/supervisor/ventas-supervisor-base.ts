import { Directive } from '@angular/core';
import { merge, takeUntil } from 'rxjs';
import { RoleId } from '../../../../../../core/auth/roles';
import { DashboardFilters } from '../../../../../../shared/components/filters/filters.component';
import { VentasAdministradorBase } from '../administrador/ventas-administrador-base';
import { CuotaDiaVendedor } from '../../../../../../core/services/ventas/cuotaDia.service';

/**
 * Base para lógica compartida del rol supervisor.
 * Usa el endpoint específico para supervisor con filtro por id_supervisor.
 */
@Directive()
export abstract class VentasSupervisorBase extends VentasAdministradorBase {

  protected override cargarVistaAdminCuotaDiaria(filtrosConsulta: DashboardFilters): void {
    if (this.rolId !== RoleId.SUPERVISOR) {
      return super.cargarVistaAdminCuotaDiaria(filtrosConsulta);
    }

    const fechaInicio = String(filtrosConsulta.fechaInicio ?? '').trim();
    const fechaFin = String(filtrosConsulta.fechaFin ?? '').trim();

    if (!fechaInicio || !fechaFin) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    const idSupervisor = this.obtenerIdSupervisorSesion();

    if (!idSupervisor) {
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    this.cuotaDiaService
      .getCuotaDiaSupervisor({ fechaInicio, fechaFin, idSupervisor })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((cuotas: any[]) => {
        this.cuotasDiariasCache = cuotas;

        if (!cuotas.length) {
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotasMapeadas = this.mapearCuotaDiariaData(cuotas);

        const cuotasFiltradas = this.filtrarPorCodigosVendedoresPermitidos(cuotasMapeadas);

        switch (this.activeVentasView) {
          case 'ventas': {
            this.chartType = 'line';

            const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
            const vendedoresFiltrados = codigoVendedorFiltro
              ? this.filtrarVendedores(cuotasFiltradas, codigoVendedorFiltro)
              : cuotasFiltradas;

            this.tableData = vendedoresFiltrados;

            this.totalCuotaDiaria = vendedoresFiltrados.reduce(
              (sum: number, item: any) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
              0,
            );

            this.chartData = [
              { name: 'Cuota Diaria', value: this.totalCuotaDiaria },
              { name: 'Venta Acumulada', value: vendedoresFiltrados.reduce((s: number, i: any) => s + (Number(i.ventaAcum ?? 0) || 0), 0) },
              { name: 'Proyección', value: vendedoresFiltrados.reduce((s: number, i: any) => s + (Number(i.proyeccionVenta ?? 0) || 0), 0) },
            ];
            break;
          }

          case 'vendedor': {
            this.chartType = 'bar';

            const codigoVendedorFiltro = String(filtrosConsulta.vendedor ?? '').trim();
            const vendedoresFiltrados = codigoVendedorFiltro
              ? this.filtrarVendedores(cuotasFiltradas, codigoVendedorFiltro)
              : cuotasFiltradas;

            this.tableData = [...vendedoresFiltrados].sort((a: any, b: any) => {
              const codigoA = this.normalizarCodigoVendedor(a?.codVendedor ?? '');
              const codigoB = this.normalizarCodigoVendedor(b?.codVendedor ?? '');
              return codigoA.localeCompare(codigoB, 'es', { numeric: true, sensitivity: 'base' });
            });

            this.totalCuotaDiaria = vendedoresFiltrados.reduce(
              (sum: number, item: any) => sum + (Number(item.cuotaDiaria ?? 0) || 0),
              0,
            );

            this.totalCuotaVendedor = this.totalCuotaDiaria;
            this.totalAcumuladoVendedor = vendedoresFiltrados.reduce(
              (sum: number, item: any) => sum + (Number(item.ventaAcum ?? 0) || 0),
              0,
            );

            const topVendedores = [...vendedoresFiltrados]
              .sort((a: any, b: any) => Number(b.ventaAcum ?? 0) - Number(a.ventaAcum ?? 0))
              .slice(0, 15);

            this.totalTopVendedores = topVendedores.reduce(
              (sum: number, item: any) => sum + (Number(item.ventaAcum ?? 0) || 0),
              0,
            );

            this.chartData = topVendedores.map((item: any) => ({
              name: item.nombre ?? item.codVendedor,
              value: Number(item.ventaAcum ?? 0),
            }));

            this.chartId = `chart-vendedor-supervisor-${Date.now()}`;
            break;
          }

          case 'proveedor':
          case 'ciudad':
          case 'categoria':
          case 'item':
          case 'cliente':
            this.tableData = [];
            this.chartData = [];
            break;
        }

        this.cdr.markForCheck();
      });
  }

  protected obtenerIdSupervisorSesion(): string | number {
    const usuario = this.authService.getVendedor();
    return usuario?.id_usuario ?? usuario?.idUsuario ?? usuario?.id ?? '';
  }
}
