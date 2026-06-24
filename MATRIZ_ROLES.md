# Matriz de Roles y Permisos — SIGC-DD

> Documento que describe qué puede hacer cada rol en el sistema.
> Basado en el código fuente real (`core/auth/roles.ts`, `core/auth/menu-items.ts`, `app.routes.ts`).

---

## 📋 Definición de Roles

Definidos en `src/app/core/auth/roles.ts`:

```ts
export enum RoleId {
  ADMINISTRADOR = 1,
  SUPERVISOR    = 2,
  VENDEDOR      = 3,
}
```

| ID | Rol | Constante | Color sugerido |
|----|-----|-----------|----------------|
| 1 | Administrador | `RoleId.ADMINISTRADOR` / `ADMIN_ROLES` | 🔴 `#dc2626` |
| 2 | Supervisor | `RoleId.SUPERVISOR` | 🟡 `#d97706` |
| 3 | Vendedor | `RoleId.VENDEDOR` | 🔵 `#1d63b8` |

---

## 🗺️ Acceso a Rutas

| Ruta | Administrador | Supervisor | Vendedor | Guard |
|------|:-:|:-:|:-:|---|
| `/login` | ✅ | ✅ | ✅ | `LoginGuard` (público) |
| `/dashboard` | ✅ | ✅ | ✅ | `RoleGuard` con `DASHBOARD_ROLES` |
| `/impactos` | ✅ | ✅ | ❌ | `RoleGuard` con `ANALISIS_ROLES` |
| `/vendedor-items` | ✅ | ✅ | ❌ | `RoleGuard` con `ANALISIS_ROLES` |
| `/carga` (ventas) | ✅ | ❌ | ❌ | `RoleGuard` con `ADMIN_ROLES` |
| `/carga-cuotas` | ✅ | ❌ | ❌ | `RoleGuard` con `ADMIN_ROLES` |
| `/gestion-usuarios` | ✅ | ❌ | ❌ | `RoleGuard` con `ADMIN_ROLES` |

Constantes:

```ts
DASHBOARD_ROLES = [1, 2, 3];
ADMIN_ROLES     = [1];
ANALISIS_ROLES  = [1, 2];
```

> **Nota**: el archivo `core/guards/auth.guard.ts` existe pero no se usa en `app.routes.ts`. Su lógica de "sesión válida" está cubierta dentro de `role.guard.ts`.

---

## 📋 Menú Lateral (Sidebar)

Definido en `core/auth/menu-items.ts`. Solo se muestran los items cuyo `roles` incluye el rol del usuario.

| Ítem | Ruta | Sección | Admin | Supervisor | Vendedor |
|------|------|---------|:-:|:-:|:-:|
| Dashboard | `/dashboard` | — | ✅ | ❌ | ❌ |
| Gestión de ventas | `/carga` | — | ✅ | ❌ | ❌ |
| Gestión de Cuotas | `/carga-cuotas` | — | ✅ | ❌ | ❌ |
| Gestión Usuarios | `/gestion-usuarios` | — | ✅ | ❌ | ❌ |
| Vendedores asignados | `/dashboard` | `?seccion=asignados` | ❌ | ✅ | ❌ |
| Análisis de ventas | `/dashboard` | `?seccion=analisis` (sup.) / `?vista=ventas` (vend.) | ❌ | ✅ | ✅ |

> **Hallazgo**: el vendedor solo tiene un ítem "Análisis de ventas" pero el admin y supervisor también acceden al dashboard, no estando limitado por el sidebar. Esto es correcto — el sidebar del vendedor solo ofrece un punto de entrada.

---

## 🛠️ Matriz Detallada de Funcionalidades

### Módulo Dashboard (`/dashboard`)

| Funcionalidad | Admin | Supervisor | Vendedor |
|---------------|:-:|:-:|:-:|
| Ver cards globales | ✅ | ❌ (filtra por equipo) | ❌ (solo propias) |
| Ver cards filtradas por equipo | ❌ | ✅ | ❌ |
| Ver cards propias | ❌ | ❌ | ✅ |
| Cambiar periodo (mes / semana / día) | ✅ | ✅ | ✅ |
| Filtro por proveedor | ✅ | ✅ (dentro de su equipo) | ✅ (sus datos) |
| Filtro por categoría | ✅ | ✅ | ✅ |
| Filtro por vendedor | ✅ (todos) | ✅ (sus asignados) | ❌ (no aplica) |
| Filtro por ciudad | ✅ | ✅ | ✅ |
| Filtro por línea | ✅ | ✅ | ✅ |
| Ver tabla de cumplimiento | ✅ | ✅ | ✅ |
| Ver gráfico de cumplimiento | ✅ | ✅ | ✅ |
| Ver análisis por ciudad | ✅ | ✅ | ✅ |
| Ver análisis por línea | ✅ | ✅ | ✅ |
| Ver análisis por proveedor | ✅ | ✅ | ✅ |
| Ver detalle por cliente | ✅ | ✅ (su equipo) | ✅ (sus clientes) |
| Ver vendedor-items | ✅ | ✅ (su equipo) | ✅ (solo suyos) |

### Módulo Impactos (`/impactos`)

| Funcionalidad | Admin | Supervisor | Vendedor |
|---------------|:-:|:-:|:-:|
| Ver análisis de impactos | ✅ | ✅ | ❌ (no tiene acceso a la ruta) |

### Módulo Carga de Ventas (`/carga`) — solo Admin

| Funcionalidad | Admin |
|---------------|:-:|
| Subir archivo `.txt` de ventas | ✅ |
| Ver progreso de carga | ✅ |
| Ver preview antes de borrar | ✅ |
| Ver logs de carga | ✅ |
| Ver clasificación de errores | ✅ (formato, columnas, datos, servidor, desconocido) |
| **Borrar ventas por rango de fechas** | ✅ |
| Confirmación textual "ELIMINAR" para borrado | ✅ |

### Módulo Carga de Cuotas (`/carga-cuotas`) — solo Admin

| Funcionalidad | Admin |
|---------------|:-:|
| Cargar cuotas por vendedor (.xlsx/archivo) | ✅ |
| Cargar cuotas por proveedor / línea con rango de fechas | ✅ |
| Cargar cuotas por categoría | ✅ |
| **Borrar cuotas proveedor por rango de fechas** | ✅ |
| **Borrar cuotas categoría por rango de fechas** | ✅ |
| Borrar cuotas de vendedor por rango | ❌ (gap) |
| Confirmación textual "ELIMINAR" para borrado | ✅ |

### Módulo Gestión de Usuarios (`/gestion-usuarios`) — solo Admin

| Funcionalidad | Admin |
|---------------|:-:|
| Listar todos los usuarios | ✅ |
| Listar supervisores (rol 2) | ✅ |
| Listar vendedores (rol 3) | ✅ |
| Listar detalle de vendedores | ✅ |
| Ver vendedores por supervisor | ✅ |
| Crear usuario vendedor | ✅ |
| Crear usuario supervisor | ✅ |
| Editar usuario (nombre, username, password, supervisor) | ✅ |
| Activar / desactivar usuario (soft) | ✅ |
| Asignar supervisor a vendedor | ✅ |
| **Eliminar usuario físicamente (DELETE)** | ❌ (gap) |
| Modal de confirmación custom para acciones destructivas | ❌ (usa `confirm()` nativo) |

### Módulo Vendedor Items (`/vendedor-items`)

| Funcionalidad | Admin | Supervisor | Vendedor |
|---------------|:-:|:-:|:-:|
| Ver listado de vendedores con items | ✅ | ✅ (sus asignados) | ❌ (no tiene acceso) |
| Ver detalle por cliente | ✅ | ✅ | ❌ |
| Ver histórico de productos por cliente | ✅ | ✅ | ❌ |

---

## 🔐 Sesión y Autenticación

| Funcionalidad | Comportamiento |
|---------------|----------------|
| Login | `POST /api/auth/login` con `codigo` o `username` + `password` |
| Token | JWT guardado en `localStorage` (vía `SessionService`) |
| Validación de sesión | `GET /api/auth/me` con cache de 60s, deshabilitado si da 404/405 |
| Sincronización entre pestañas | `storage` event con `auth_event` y nonce |
| Inactividad | Auto-logout a los 60 min,监听 `mousemove/keydown/click/scroll/touchstart` |
| 401 / 403 | `auth.interceptor` limpia sesión y redirige a `/login` |
| Logout | Limpia storage, cancela timer, navega a `/login` con `replaceUrl: true` |

> **Verificación de rol**: `RoleGuard` lee `route.data['roles']` y compara con `usuario.rol.idRol || usuario.idRol`. Si no coincide, redirige a `/dashboard`.

---

## 📊 Resumen Visual

```
                    ADMIN    SUPERVISOR    VENDEDOR
                   ───────   ──────────   ─────────
Dashboard             ✅          ✅           ✅
Análisis impactos     ✅          ✅           ❌
Vendedor items        ✅          ✅           ❌
Carga ventas          ✅          ❌           ❌
Carga cuotas          ✅          ❌           ❌
Borrar ventas         ✅          ❌           ❌
Borrar cuotas         ✅          ❌           ❌
Crear usuarios        ✅          ❌           ❌
Editar usuarios       ✅          ❌           ❌
Activar/Desactivar    ✅          ❌           ❌
Asignar supervisor    ✅          ❌           ❌
DELETE usuario        ❌ (gap)    ❌           ❌
Borrar cuota vend.    ❌ (gap)    ❌           ❌
```

---

## 🚦 Semáforo

- 🟢 Funciona correctamente y bien implementado.
- 🟡 Funciona pero tiene deuda técnica (tipo `any`, falta de OnPush, etc.).
- 🔴 No implementado o con bug conocido.

| Funcionalidad Admin | Estado |
|---------------------|--------|
| Login | 🟢 |
| Dashboard global | 🟢 |
| Carga de ventas | 🟢 |
| Borrar ventas | 🟢 |
| Carga de cuotas | 🟢 |
| Borrar cuotas proveedor/categoría | 🟢 |
| Borrar cuotas vendedor | 🔴 (gap) |
| Crear usuarios | 🟢 |
| Editar usuarios | 🟡 (mucho `any`) |
| Activar/Desactivar usuarios | 🟢 |
| Eliminar usuarios (físico) | 🔴 (gap) |
| Asignar supervisor | 🟢 |
| Inactividad / auto-logout | 🟢 |
| Sincronización entre pestañas | 🟢 |
| Guards por rol | 🟢 |
| Responsive | 🟢 (recientemente mejorado) |

---

## 📝 Conclusión sobre el Administrador

**El administrador SÍ tiene acceso completo** a las funcionalidades clave que requiere:

- ✅ Cargar ventas (archivo `.txt`).
- ✅ Cargar cuotas (3 tipos).
- ✅ Borrar ventas por rango de fechas.
- ✅ Borrar cuotas de proveedor y categoría por rango.
- ✅ Crear, editar y desactivar usuarios.
- ✅ Asignar supervisores a vendedores.

**Solo tiene 2 gaps** que cubrir:

1. **DELETE físico de usuarios** (operación común en CRUDs).
2. **Borrado de cuotas de vendedor por rango** (workaround: sobreescribir).

Ambos son de prioridad media y no bloquean el uso normal del sistema.

Ver detalle y plan de remediación en [HALLAZGOS_Y_ANALISIS.md](./HALLAZGOS_Y_ANALISIS.md).

---

**Versión del documento**: junio 2026.
**Versión del proyecto**: 1.0.0.
