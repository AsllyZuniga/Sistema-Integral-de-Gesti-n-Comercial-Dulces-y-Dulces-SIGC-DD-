# Refactor frontend - módulo ventas

Cambios realizados sin cambiar endpoints ni lógica de negocio:

- Se separó la plantilla grande de `ventas` en componentes presentacionales:
  - `VentasTabsComponent`
  - `VentasTablaGraficaComponent`
  - `VentasClientesDetalleComponent`
- Se corrigió una etiqueta `<label>` duplicada en el buscador de clientes.
- Se centralizó la configuración de vistas de ventas en `ventas-view.config.ts`.
- Se centralizaron roles en `core/auth/roles.ts`.
- Se centralizaron opciones de menú en `core/auth/menu-items.ts`.
- Se dejaron rutas con `RoleGuard` y roles centralizados.
- Se limpió el entregable eliminando `.git`, `.angular`, `dist` y `node_modules` del ZIP.

Validación realizada:

```bash
npm install --no-audit --no-fund
npm run build -- --configuration development
```

La compilación de desarrollo fue exitosa. La compilación production puede seguir dependiendo de presupuestos existentes en `angular.json` y de acceso a Google Fonts si se usa optimización de fuentes.
