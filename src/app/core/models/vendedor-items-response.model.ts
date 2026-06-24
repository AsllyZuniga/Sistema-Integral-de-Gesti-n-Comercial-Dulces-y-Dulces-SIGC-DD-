import { Paginacion } from './paginacion.model';
import { VendedorConClientes } from './vendedor.model';

export interface VendedorItemsData {
  vendedores: VendedorConClientes[];
  paginacionVendedores: Paginacion | null;
}

export interface VendedorItemsResponse {
  success: boolean;
  data: VendedorItemsData;
  message: string;
}
