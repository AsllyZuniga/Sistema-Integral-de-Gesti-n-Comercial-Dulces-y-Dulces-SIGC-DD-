import { Directive } from '@angular/core';
import { VentasAdministradorBase } from '../administrador/ventas-administrador-base';

/**
 * Base para lógica compartida del rol supervisor.
 * Actualmente el supervisor reutiliza parte de la lectura del administrador,
 * pero filtrada por los vendedores asignados desde el dashboard padre.
 */
@Directive()
export abstract class VentasSupervisorBase extends VentasAdministradorBase {}
