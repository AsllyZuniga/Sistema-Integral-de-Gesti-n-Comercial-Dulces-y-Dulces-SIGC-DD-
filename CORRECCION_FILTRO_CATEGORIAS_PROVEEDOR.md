# Corrección filtro Categoría por Proveedor

Se corrigió la lógica del dashboard para que, al seleccionar un proveedor, el filtro de categorías se alimente desde las categorías reales que vienen en `detalle[].detallePorProveedor[].categorias`.

## Archivo modificado

- `src/app/features/dashboard/dashboard.component.ts`

## Ajustes realizados

- Se mantiene la respuesta original/cacheada del endpoint de cumplimiento.
- Al seleccionar proveedor, se filtran las categorías usando la respuesta original, no un arreglo ya filtrado o vacío.
- Se agregó comparación flexible de proveedor para soportar estos casos:
  - `020`
  - `20`
  - `020 - ARCOR`
  - `codigoProveedor`
  - `idProveedor`
  - `nombreProveedor`
  - `linea`
- Se mantiene la opción `Todas` en el componente visual existente.
- No se modificó la estructura visual ni la lógica de carga de ventas, cards, cumplimiento o proyección.

## Motivo del bug

El filtro podía quedar solo con `Todas` cuando el valor seleccionado del proveedor no coincidía exactamente con `codigoProveedor` en la respuesta del endpoint. Por ejemplo, si en algún punto el filtro manejaba `020 - ARCOR` pero la API trae `codigoProveedor: "020"`, la comparación fallaba y no se encontraban las categorías del proveedor.
