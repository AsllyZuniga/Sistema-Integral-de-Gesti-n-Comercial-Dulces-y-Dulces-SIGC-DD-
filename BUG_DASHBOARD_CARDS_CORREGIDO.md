# Bug corregido: actualización de cards del dashboard de ventas

## Archivos modificados

- `src/app/core/services/ventas/cuotaDia.service.ts`
- `src/app/features/dashboard/dashboard.component.ts`
- `src/app/features/dashboard/dashboard.html`
- `src/app/features/dashboard/dashboard.css`
- `src/app/features/dashboard/views/administrador/administrador.component.ts`
- `src/app/features/dashboard/views/administrador/administrador.component.html`

## Correcciones principales

1. Al cambiar entre Cuota mensual, Cuota semanal y Cuota diaria, ahora el dashboard ajusta el rango para todos los roles: ADMIN, SUPERVISOR y VENDEDOR.
2. Al aplicar filtros, el rango queda sincronizado con el periodo activo:
   - Mensual: primer día al último día del mes.
   - Semanal: lunes a domingo de la semana seleccionada.
   - Diaria: mismo día en fecha_inicio y fecha_fin.
3. Para rol VENDEDOR + Cuota diaria, las cards consumen directamente `/api/roles/cuota-dia/por-vendedor`.
4. El mapeo del vendedor diario queda así:
   - `venta_acumulada_dia` -> Venta diaria.
   - `cuota_dia` -> Cuota diaria.
   - `pct_cumplimiento` -> Cumplimiento.
   - `proye_venta` -> Proyección.
5. Si el endpoint diario del vendedor responde 401, 403 o 404, se muestra un mensaje y las cards se limpian para evitar datos viejos.
6. En ADMIN, la card de venta ya no depende del evento `resumenCambio` emitido por `app-ventas`, sino de los totales cargados con el filtro aplicado.
7. Las tablas se siguen actualizando mediante los inputs `filtrosActivos`, `filtrosAnalisis` y `tipoCuota`, manteniendo sincronizado el estado del dashboard.

## Validación realizada

Se ejecutó:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Resultado: sin errores TypeScript.

También se ejecutó:

```bash
npm run build -- --optimization=false
```

El build compila el código, pero el proyecto sigue fallando por budgets ya existentes en `angular.json`:

- Bundle inicial supera el límite de 1 MB.
- Algunos CSS superan los límites configurados.

Estos budgets no corresponden a la corrección del bug.
