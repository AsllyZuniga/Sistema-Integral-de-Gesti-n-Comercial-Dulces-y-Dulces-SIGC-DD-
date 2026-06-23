import { Routes } from '@angular/router';

export const VENDEDOR_ITEMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/vendedor-items-page/vendedor-items-page.component').then(
        (m) => m.VendedorItemsPageComponent,
      ),
  },
];
