import { Directive } from '@angular/core';
import { merge, takeUntil } from 'rxjs';
import { RoleId } from '../../../../../../core/auth/roles';
import { DashboardFilters } from '../../../../../../shared/components/filters/filters.component';
import { VentasAdministradorBase } from '../administrador/ventas-administrador-base';
import { CuotaDiaVendedor, CuotaDiaSupervisorResponse } from '../../../../../../core/services/ventas/cuotaDia.service';

/**
 * Base para lógica compartida del rol supervisor.
 * Usa el endpoint específico para supervisor con filtro por id_supervisor.
 * Endpoint: GET /api/roles/cuota-dia/por-supervisor?fecha_inicio=X&fecha_fin=Y&id_supervisor=Z
 * Respuesta: { success, data[], message, supervisor: { id_usuario, username }, total_vendedores }
 * Errores: 401 (Sin token), 403 (Rol ≠ 1), 404 (Supervisor no encontrado o no tiene rol 2)
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
      console.warn('[Supervisor CuotaDiaria] No se encontró id_supervisor en sesión');
      this.tableData = [];
      this.chartData = [];
      this.totalCuotaDiaria = 0;
      this.cdr.markForCheck();
      return;
    }

    console.debug('[Supervisor CuotaDiaria] Cargando datos del supervisor:', {
      fechaInicio,
      fechaFin,
      idSupervisor,
    });

    this.cuotaDiaService
      .getCuotaDiaSupervisor({ fechaInicio, fechaFin, idSupervisor })
      .pipe(takeUntil(merge(this.destroy$, this.recargarVista$)))
      .subscribe((response: CuotaDiaSupervisorResponse) => {
        console.debug('[Supervisor CuotaDiaria] Respuesta:', {
          success: response?.success,
          totalRegistros: response?.data?.length ?? 0,
          message: response?.message,
          supervisor: response?.supervisor,
          totalVendedores: response?.total_vendedores,
        });

        if (!response?.success || !Array.isArray(response.data) || !response.data.length) {
          console.warn('[Supervisor CuotaDiaria] Sin datos o error:', response?.message);
          this.tableData = [];
          this.chartData = [];
          this.totalCuotaDiaria = 0;
          this.cdr.markForCheck();
          return;
        }

        const cuotas = response.data;
        this.cuotasDiariasCache = cuotas;

        const supervisorInfo = response.supervisor;
        const totalVendedores = response.total_vendedores ?? 0;

        console.debug('[Supervisor CuotaDiaria] Info supervisor:', supervisorInfo);
        console.debug('[Supervisor CuotaDiaria] Total vendedores:', totalVendedores);

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
