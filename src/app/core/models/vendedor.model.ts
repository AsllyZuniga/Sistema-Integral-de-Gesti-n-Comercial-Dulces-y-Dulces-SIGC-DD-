import { ClienteConItems } from './cliente.model';
import { Paginacion } from './paginacion.model';

export interface VendedorConClientes {
  id_vendedor: number;
  codigo_vendedor: string;
  nombre: string;
  clientes: ClienteConItems[];
  paginacionClientes: Paginacion;
}
