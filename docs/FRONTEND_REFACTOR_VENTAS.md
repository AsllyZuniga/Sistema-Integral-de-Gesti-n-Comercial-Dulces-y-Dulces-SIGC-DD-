# Refactor frontend - ventas

Cambios realizados sin modificar rutas ni endpoints:

- Se eliminó la carpeta `logic` y el archivo gigante `ventas-component-base.ts`.
- La lógica de ventas quedó repartida por intención:
  - `config/`: configuración de vistas de ventas.
  - `models/`: modelos base de ventas.
  - `services/`: estado, transformaciones, utilidades y clientes.
  - `roles/administrador/`: lógica propia de la vista administrativa.
  - `roles/supervisor/`: capa de rol supervisor, que reutiliza la lógica administrativa filtrada por vendedores asignados.
  - `roles/vendedor/`: carga propia del vendedor.
  - `ui/`: componentes visuales reutilizables.
- El sidebar quedó como componente compartido y se alimenta desde `core/auth/menu-items.ts`.
- El filtro de proveedor ahora permite selección múltiple con checkbox.
- Al cambiar proveedor se limpian las categorías seleccionadas y se actualiza el catálogo de categorías según el proveedor seleccionado.
- En la vista por ciudad se muestra la suma total de venta acumulada arriba de la tabla.
- En administrador, la vista de vendedores ordena por código de vendedor.

Validación realizada:

```bash
npm run build -- --configuration development
```

Resultado: compilación exitosa.
