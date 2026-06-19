# Corrección tabla de supervisores / Vendedores Asignados

## Problema
En la vista del rol **SUPERVISOR**, dentro de la sección **Vendedores Asignados**, los nombres largos de vendedores sobrepasaban el ancho de la columna **Nombre** y se montaban sobre las columnas siguientes.

## Archivo modificado

- `src/app/features/dashboard/views/shared/vendedores-table/vendedores-table.component.css`

## Corrección aplicada

Se agregaron reglas CSS específicas para la tabla usada por el rol supervisor:

- La tabla del supervisor ahora usa `table-layout: fixed` para respetar el ancho de las columnas.
- La columna **Código** tiene un ancho fijo.
- La columna **Nombre** tiene un ancho controlado con `clamp(...)`.
- Los nombres largos ahora hacen salto de línea dentro de su columna.
- Se agregó `overflow-wrap: anywhere` y `word-break: break-word` para evitar que el texto invada otras columnas.
- Las columnas numéricas mantienen `white-space: nowrap` para que los valores de venta, cuota, cumplimiento y proyección no se partan.
- En pantallas pequeñas se mantiene scroll horizontal y una anchura mínima suficiente.

## Resultado esperado

En **Supervisor > Vendedores Asignados**, los nombres largos ya no se sobreponen sobre las columnas de métricas. El texto baja de línea dentro de la columna Nombre y la tabla conserva el scroll horizontal cuando sea necesario.
