import { ItemComprado } from './item.model';
import { Paginacion } from './paginacion.model';

export interface ClienteConItems {
  id_cliente: number;
  nro_documento: string;
  razon_social: string;
  totalCompras: number;
  items: ItemComprado[];
  paginacionItems: Paginacion;
}
