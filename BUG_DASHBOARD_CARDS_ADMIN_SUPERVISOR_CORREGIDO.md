# Corrección adicional: cards diarias ADMIN y SUPERVISOR

Se revisó y corrigió el flujo de **Cuota diaria** para que las cards principales no dependan de cambiar de sección en el análisis de ventas.

## Archivos modificados

- `src/app/core/services/ventas/cuotaDia.service.ts`
- `src/app/features/dashboard/views/administrador/administrador.component.ts`
- `src/app/features/dashboard/views/administrador/administrador.component.html`
- `src/app/features/dashboard/views/supervisor/supervisor.component.ts`
- `src/app/features/dashboard/views/supervisor/supervisor.component.html`

## ADMIN

Cuando el periodo activo es **Cuota diaria**, las cards usan directamente:

```http
GET /api/cuota-dia/por-dia?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
```

Mapeo aplicado:

- `venta_acumulada_dia` → Venta diaria
- `cuota_dia` → Cuota diaria
- `pct_cumplimiento` → Cumplimiento
- `proye_venta` → Proyección

## SUPERVISOR

Cuando el periodo activo es **Cuota diaria**, las cards usan directamente:

```http
GET /api/roles/cuota-dia/por-supervisor?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD&id_supervisor=ID
```

Mapeo aplicado por cada vendedor del supervisor:

- `venta_acumulada_dia` → Venta diaria
- `cuota_dia` → Cuota diaria
- `pct_cumplimiento` → Cumplimiento
- `proye_venta` → Proyección

Los totales de las cards se calculan sumando los vendedores del resultado filtrado.

## Manejo de errores

Para ADMIN y SUPERVISOR se limpian las cards cuando hay error o no hay datos, evitando valores viejos.

Mensajes manejados:

- `401`: sesión expirada o token inválido.
- `403`: permisos insuficientes.
- `404`: no encontrado / supervisor no válido / sin datos.
- Otros errores: mensaje genérico de error de consulta.

## Validación

Se validó TypeScript con:

```bash
npx tsc -p tsconfig.app.json --noEmit
```

Resultado: sin errores TypeScript después de la corrección.
