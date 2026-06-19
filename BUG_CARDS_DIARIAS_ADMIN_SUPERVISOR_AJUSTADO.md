# Corrección cards diarias ADMIN / SUPERVISOR

## Problema encontrado

Las cards de **Venta Diaria**, **Cuota Diaria**, **Cumplimiento** y **Proyección** quedaron tomando datos desde los endpoints de cuota diaria:

- `GET /api/cuota-dia/por-dia`
- `GET /api/roles/cuota-dia/por-supervisor`

Esos endpoints devuelven información de cuotas por vendedor, pero no necesariamente respetan todos los filtros comerciales activos del dashboard, como proveedor, categoría, ciudad, línea o vendedor. Por eso las cards podían quedar infladas o diferentes al **Total Acumulado** mostrado en el análisis de ventas.

## Ajuste aplicado

Se corrigió la lógica para que en ADMIN y SUPERVISOR las cards principales vuelvan a tomar los valores desde los mismos endpoints de cumplimiento/ventas que alimentan la tabla y el análisis:

- ADMIN diaria: `cumplimientoService.getCumplimientoDiaAdmin(filtros)`
- SUPERVISOR diaria: `cumplimientoService.getCumplimientoDiaSupervisor(idSupervisor, filtros)`

Así las cards quedan sincronizadas con el mismo rango y filtros aplicados en el dashboard.

## Archivos modificados

- `src/app/features/dashboard/views/administrador/administrador.component.ts`
- `src/app/features/dashboard/views/supervisor/supervisor.component.ts`

## Qué se conserva

- No se tocó la lógica de VENDEDOR + Cuota diaria.
- No se tocó la corrección visual de la tabla de supervisores.
- No se volvió a depender del cambio de sección para actualizar las cards.

## Resultado esperado

Al aplicar filtro en Cuota diaria:

- La card **Venta Diaria** debe coincidir con el total real filtrado del análisis.
- La cuota y el cumplimiento se calculan desde la misma tabla/listado filtrado.
- No deben quedar valores duplicados o inflados desde los endpoints de cuota diaria.
