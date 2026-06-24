# Hallazgos y Análisis Técnico — SIGC-DD

> Reporte de auditoría técnica del proyecto realizada en junio 2026.
> Cubre arquitectura, roles, funcionalidades, calidad de código y gaps detectados.

---

## 📋 Tabla de contenidos

1. [Resumen Ejecutivo](#-resumen-ejecutivo)
2. [Funcionalidades del Administrador](#-funcionalidades-del-administrador)
3. [Gaps Críticos Detectados](#-gaps-críticos-detectados)
4. [Problemas de Arquitectura y Calidad](#-problemas-de-arquitectura-y-calidad)
5. [Oportunidades de Mejora](#-oportunidades-de-mejora)
6. [Recomendaciones por Prioridad](#-recomendaciones-por-prioridad)
7. [Validación Sugerida](#-validación-sugerida)

---

## 🎯 Resumen Ejecutivo

El proyecto **SIGC-DD** está bien estructurado para una aplicación empresarial Angular 21: usa standalone components, lazy loading, guards por rol, interceptor JWT y separación de responsabilidades. Sin embargo, se detectaron:

- **1 gap funcional crítico** (DELETE físico de usuarios).
- **2 problemas de arquitectura menores** (guard sin uso, archivo de re-export innecesario).
- **5 oportunidades de calidad** (tipado, OnPush, refactors).
- **Buenas prácticas cumplidas** en la mayoría de los flujos de admin.

**Veredicto**: el Administrador **SÍ** puede cargar ventas, cargar cuotas, borrar ventas, borrar cuotas, crear/editar/activar-desactivar usuarios y asignar supervisores. **NO** puede eliminar usuarios físicamente (solo desactivar).

---

## ✅ Funcionalidades del Administrador

Verificación basada en el código fuente a junio 2026.

### 1. Carga de Ventas ✅

**Ruta**: `/carga` — `CargaComponent` (`features/carga/carga-ventas/carga.component.ts`).
**Guard**: `RoleGuard` con `roles: ADMIN_ROLES`.
**Permisos**: ✅ Solo administradores.

**Capacidades:**

| Acción | Implementado | Detalle |
|--------|--------------|---------|
| Subir archivo `.txt` | ✅ | `POST /api/import/ventas/upload` con `FormData` y `reportProgress` |
| Validar formato | ✅ | Solo acepta `.txt` (exportación del ERP) |
| Ver preview | ✅ | `GET /api/admin/ventas/preview?fechaInicio&fechaFin` |
| Ver progreso | ✅ | `uploadProgress`, `processedLines`, `totalAcumulado` |
| Ver logs | ✅ | `showLogs` con `rawLog` |
| Manejo de errores | ✅ | Clasificación: `formato`, `columnas`, `datos`, `servidor`, `desconocido` |
| **Borrar ventas** | ✅ | `DELETE /api/admin/ventas?fechaInicio&fechaFin` con confirmación textual "ELIMINAR" |

**Calidad**:

- ✅ Confirmación con texto "ELIMINAR" (no solo click).
- ✅ Mensaje formateado con conteo de ventas y detalles eliminados.
- ✅ Manejo de error `0` (CORS/conexión) y `4xx/5xx`.
- ⚠️ `HttpClient` inyectado directamente en el componente (mejor tener un `VentasAdminService`).

### 2. Carga de Cuotas ✅

**Ruta**: `/carga-cuotas` — `CargaCuotasComponent`.
**Permisos**: ✅ Solo administradores.

**Capacidades por tipo:**

| Tipo de cuota | Subir | Borrar por fechas | Endpoint borrar |
|---------------|-------|-------------------|-----------------|
| **Vendedor** | ✅ | ❌ | — |
| **Proveedor / Línea** | ✅ | ✅ | `DELETE /api/vendedor-cuota-proveedor/rango/por-fechas` |
| **Categoría** | ✅ | ✅ | `DELETE /api/vendedor-cuota-categoria/rango/por-fechas` |

**Hallazgo**: el admin **NO** puede borrar cuotas de vendedor por rango de fechas (solo las puede sobreescribir subiendo un nuevo archivo). Ver [Gaps](#-gaps-críticos-detectados).

**Calidad**:

- ✅ Subcomponentes separados (`CuotaVendedorUploadComponent`, `CuotaProveedorUploadComponent`, `CuotaCategoriaUploadComponent`).
- ✅ Confirmación textual "ELIMINAR" para borrados destructivos.
- ✅ Rango de fechas validado (inicio ≤ fin).
- ✅ Mensajes de éxito/error con `tipoOperacion`.

### 3. Gestión de Usuarios ⚠️

**Ruta**: `/gestion-usuarios` — `GestionUsuariosComponent`.
**Permisos**: ✅ Solo administradores.
**Servicio**: `UsuariosService` (`core/services/usuarios.service.ts`).

**Capacidades:**

| Acción | Implementado | Endpoint / Método |
|--------|--------------|-------------------|
| Listar usuarios | ✅ | `GET /api/usuario` |
| Listar supervisores (rol 2) | ✅ | `GET /api/usuario` (filtrado local) |
| Listar vendedores (rol 3) | ✅ | `GET /api/usuario` (filtrado local) |
| Listar detalle vendedores | ✅ | `GET /api/vendedor` |
| Vendedores por supervisor | ✅ | `GET /api/vendedor/supervisor/{id}` (con cache) |
| Crear usuario (vendedor/supervisor) | ✅ | `POST /api/usuario` |
| Crear vendedor (perfil) | ✅ | `POST /api/vendedor` |
| Actualizar usuario | ✅ | `PUT /api/usuario/{id}` |
| Actualizar vendedor | ✅ | `PUT /api/vendedor/{id}` |
| Asignar supervisor a vendedor | ✅ | `PUT /api/vendedor/{id}/asignar-supervisor` |
| Desactivar usuario (soft) | ✅ | `PUT /api/usuario/{id}` con `estado: false` |
| Reactivar usuario | ✅ | `PUT /api/usuario/{id}` con `estado: true` |
| **Eliminar usuario (físico)** | ❌ | **NO IMPLEMENTADO** |

**Calidad**:

- ✅ Cache de vendedores por supervisor con `shareReplay` + invalidación.
- ✅ Sincronización local + recarga del backend tras asignar.
- ✅ Formularios separados para crear/editar vendedor y supervisor.
- ✅ Tabla compartida `VendedoresTableComponent` con `table-layout: fixed`.
- ⚠️ `confirm()` nativo del navegador (no modal custom).
- ⚠️ `any` extensivo en el componente (más de 30 ocurrencias).

### 4. Dashboards y Análisis ✅

**Ruta**: `/dashboard` — `DashboardComponent` (con vistas por rol).
**Permisos**: ✅ Todos los roles ven `/dashboard`, pero el contenido se filtra por rol.

**Capacidades del admin**:

- ✅ Cards KPI globales (venta, cuota, cumplimiento, proyección).
- ✅ Filtros globales (proveedor, categoría, vendedor, ciudad, línea, periodo: mes/semana/día).
- ✅ Vendedores con items.
- ✅ Análisis de ventas por ciudad/línea/proveedor.
- ✅ Devoluciones.
- ✅ Impactos (`/impactos` — ruta propia).
- ✅ Vendedor-items (`/vendedor-items`).

**Calidad**:

- ✅ Refactor reciente separando por intención (`ui/`, `services/`, `roles/`, `config/`, `models/`).
- ✅ Cache por clave de filtros en `CumplimientoService`.
- ✅ Comparación flexible de proveedor (corrige bug de filtro de categorías).
- ✅ Cards sincronizadas con la tabla filtrada.

---

## 🚨 Gaps Críticos Detectados

### GAP-1: Admin NO puede eliminar usuarios físicamente

**Severidad**: 🟡 Media (funcionalidad común en CRUD).

**Descripción**: en `GestionUsuariosComponent` solo existe `toggleEstadoVendedor` / `toggleEstadoSupervisor` que hace soft-delete (cambia `estado: false`). El servicio `UsuariosService` **NO** expone un método `eliminarUsuario(id)`.

**Impacto**: el admin no puede limpiar usuarios creados por error ni cumplir con solicitudes de "derecho al olvido" sin pedir soporte al backend.

**Recomendación**:

1. Agregar método en `UsuariosService`:
   ```ts
   eliminarUsuario(idUsuario: string | number): Observable<any> {
     return this.http.delete(`${this.apiUrl}/usuario/${idUsuario}`).pipe(
       catchError((err) => throwError(() => err))
     );
   }
   ```
2. Verificar que el backend expone `DELETE /api/usuario/{id}`.
3. Agregar botón "Eliminar" en `vendedores-table` con modal de confirmación (texto "ELIMINAR" como las cuotas).
4. Invalidar cache de `vendedoresPorSupervisor` tras eliminar.

### GAP-2: Admin NO puede borrar cuotas de vendedor por rango

**Severidad**: 🟢 Baja (workaround: sobreescribir con nuevo archivo).

**Descripción**: `CuotasUploadService` expone:
- `eliminarCuotasProveedorPorFechas()` ✅
- `eliminarCuotasCategoriaPorFechas()` ✅
- `eliminarCuotasVendedorPorFechas()` ❌ (no existe).

**Recomendación**: si el backend lo soporta, agregar método paralelo y exponer UI en `CargaCuotasComponent`.

### GAP-3: `features/carga/carga.component.ts` es solo un re-export

**Severidad**: 🟢 Cosmética.

```ts
// features/carga/carga.component.ts
export { CargaComponent } from './carga-ventas/carga.component';
```

**Recomendación**: eliminar el archivo y actualizar `app.routes.ts` para apuntar directo a `./carga/carga-ventas/carga.component` (o mover el componente real a `carga.component.ts`).

---

## 🏗️ Problemas de Arquitectura y Calidad

### ARQ-1: `auth.guard.ts` existe pero no se usa

**Archivo**: `src/app/core/guards/auth.guard.ts`.
**Problema**: importa `AuthService`, valida `isLoggedIn()` y sesión backend con `validarSesionBackendUnaVez()`, pero **no está en `app.routes.ts`**.

**Riesgo**: código muerto que puede confundir a mantenedores. Su funcionalidad está cubierta por `role.guard.ts` (que también valida `isLoggedIn` y llama `iniciarTimerInactividad`).

**Recomendación**: elegir una de las dos opciones:
- **A**: eliminar `auth.guard.ts` (recomendado, menos archivos, menos confusión).
- **B**: aplicarlo en una ruta y dejar `RoleGuard` solo para permisos (más separación).

### ARQ-2: Tipo `any` extensivo en `UsuariosService` y `GestionUsuariosComponent`

Más de 60 ocurrencias de `any` entre el servicio y el componente. Esto impide que TypeScript ayude a encontrar bugs en el manejo de datos del backend.

**Recomendación**:
1. Crear interfaces en `core/models/usuario.model.ts`:
   ```ts
   export interface Usuario { id: number; username: string; id_rol: number; estado: boolean; ... }
   export interface Vendedor extends Usuario { codigo_vendedor: string; nombre: string; id_supervisor?: number; }
   export interface Supervisor extends Usuario { vendedores?: Vendedor[]; }
   ```
2. Tipar retornos de `listarUsuarios(): Observable<Usuario[]>`.
3. Reemplazar `any` por tipos específicos o `unknown` en handlers.

### ARQ-3: Pocos componentes usan `OnPush`

Solo `LoginComponent` usa `ChangeDetectionStrategy.OnPush`. Componentes pesados como `DashboardComponent` y `GestionUsuariosComponent` usan default, lo que aumenta trabajo de detección de cambios.

**Recomendación**: agregar `changeDetection: ChangeDetectionStrategy.OnPush` a:
- `DashboardComponent`
- `GestionUsuariosComponent`
- `CargaComponent`
- `CargaCuotasComponent`
- `VendedoresTableComponent`
- Componentes de ventas

Y asegurar que los datos lleguen por `@Input` con `async` pipe o `OnPush`-friendly (no mutar objetos, usar inmutabilidad).

### ARQ-4: Suscripciones con `.subscribe()` + `cd.detectChanges()`

Patrón actual en la mayoría de componentes: `subscribe()` + `this.cdr.detectChanges()`. Esto se puede modernizar con:

- **`async` pipe** en templates (`observable$ | async`).
- **`takeUntilDestroyed()`** de Angular 16+ (reemplaza `Subject<void> + takeUntil(destroy$)`).
- **`signal()` / `toSignal()`** de Angular 17+.

**Beneficio**: menos código boilerplate, sin memory leaks, mejor rendimiento.

### ARQ-5: `HttpClient` inyectado directamente en `CargaComponent`

`CargaComponent` (carga de ventas) inyecta `HttpClient` y construye URLs y `FormData` directamente. Lo correcto es delegar a un servicio `VentasAdminService` para mantener la regla de "componentes sin HTTP directo".

**Recomendación**: extraer lógica HTTP a un servicio y dejar el componente con UI y estado.

---

## 🚀 Oportunidades de Mejora

### Mejora 1: Modal de confirmación en lugar de `confirm()` nativo

`GestionUsuariosComponent` usa `confirm()` del navegador. Sería más consistente con el resto del sistema usar el mismo modal de "ELIMINAR" con input textual que se usa en `CargaComponent` y `CargaCuotasComponent`.

### Mejora 2: Página de perfil de usuario

No existe pantalla para que el usuario autenticado vea/edite su propio perfil o cambie su contraseña. Sería un valor agregado.

### Mejora 3: Auditoría / log de acciones admin

Para un sistema que maneja borrados de ventas y cuotas, sería útil un log de "quién borró qué y cuándo" (esto suele ser backend, pero un frontend que muestre el log al admin también aporta).

### Mejora 4: Budgets de `angular.json`

El build de producción falla por:

- Bundle inicial > 1 MB.
- Algunos CSS > límites.

**Recomendación**: revisar `angular.json` y:
- Aumentar budgets con justificación.
- O usar `loadChildren` para features grandes (dashboard ya está lazy, pero podría partirse más).
- Habilitar `optimization.fonts.inline` para evitar fetch externo de Google Fonts en build prod.

### Mejora 5: Tests unitarios

Solo se configuran `vitest` y `jsdom` pero no hay archivos `*.spec.ts` en el proyecto. Para un sistema empresarial con borrados destructivos, los tests son críticos.

**Recomendación**: empezar con tests para:
- `RoleGuard` (autorización).
- `AuthService.logout()`.
- `CuotasUploadService.eliminar*()`.
- `UsuariosService` métodos críticos.

### Mejora 6: Documentar variables de entorno

`environment.ts` está en el repo. Sería buena práctica:
- Usar `environment.prod.ts` con valores diferentes para prod.
- Documentar cada variable en `README.md`.

---

## 🎯 Recomendaciones por Prioridad

### 🔴 Prioridad Alta (esta semana)

1. **Agregar DELETE de usuarios** en `UsuariosService` + UI en `GestionUsuariosComponent` (GAP-1).
2. **Eliminar `auth.guard.ts` o aplicarlo** para evitar código muerto (ARQ-1).
3. **Eliminar `features/carga/carga.component.ts`** re-export o mover el componente real (GAP-3).

### 🟡 Prioridad Media (próximas 2 semanas)

4. Tipar `UsuariosService` y `GestionUsuariosComponent` con interfaces (ARQ-2).
5. Aplicar `OnPush` a componentes pesados (ARQ-3).
6. Refactorizar `CargaComponent` para usar `VentasAdminService` (ARQ-5).
7. Modal de confirmación en gestión de usuarios (Mejora 1).

### 🟢 Prioridad Baja (backlog)

8. Migrar a `takeUntilDestroyed()` y `toSignal()` (ARQ-4).
9. Pantalla de perfil (Mejora 2).
10. Ajustar budgets de `angular.json` (Mejora 4).
11. Agregar tests unitarios críticos (Mejora 5).
12. Documentar environments (Mejora 6).
13. Evaluar borrado de cuotas de vendedor por fechas (GAP-2).

---

## ✅ Validación Sugerida

Antes de hacer merge de los cambios propuestos:

```bash
# 1. Compilación TypeScript
npx tsc -p tsconfig.app.json --noEmit

# 2. Build de desarrollo
npm run build -- --configuration development

# 3. Build de producción (verificar budgets)
npm run build

# 4. Tests
npm test

# 5. Linter (si está configurado)
npm run ng -- lint
```

Pruebas manuales recomendadas:

- [ ] Login con cada uno de los 3 roles.
- [ ] ADMIN: cargar archivo `.txt` válido → ver progreso y resultado.
- [ ] ADMIN: borrar ventas de un rango → confirmar con texto "ELIMINAR".
- [ ] ADMIN: cargar cuotas (3 tipos) → borrar las que tienen endpoint.
- [ ] ADMIN: crear usuario vendedor y supervisor.
- [ ] ADMIN: asignar supervisor a vendedor y ver en su lista.
- [ ] ADMIN: desactivar usuario y verificar que sigue apareciendo con estado "Inactivo".
- [ ] SUPERVISOR: login → ver solo sus vendedores asignados.
- [ ] VENDEDOR: login → ver solo sus propias métricas.
- [ ] Responsive: probar en móvil (< 560px) cada vista.

---

**Reporte generado**: junio 2026.
**Versión del proyecto auditada**: 1.0.0.
**Auditor**: Análisis técnico del código fuente.
