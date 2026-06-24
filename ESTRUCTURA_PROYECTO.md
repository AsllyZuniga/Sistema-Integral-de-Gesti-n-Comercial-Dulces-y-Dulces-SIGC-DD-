# Estructura del Proyecto — SIGC-DD

> Mapa detallado de la estructura real del proyecto a junio 2026.

---

## 📁 Vista General del Repositorio

```
Sistema-Integral-de-Gesti-n-Comercial-Dulces-y-Dulces-SIGC-DD-/
├── docs/                                # Documentación técnica detallada
│   └── FRONTEND_REFACTOR_VENTAS.md
├── public/                              # Assets públicos servidos tal cual
│   ├── favicon.ico
│   ├── logoDulces.png
│   └── infa2.png
├── src/
│   ├── app/                             # Aplicación Angular
│   ├── assets/
│   ├── environments/
│   ├── index.html
│   ├── main.ts
│   └── styles.css                       # Estilos globales + Tailwind
│
├── angular.json                         # Configuración CLI
├── package.json                         # Dependencias y scripts
├── postcss.config.js
├── proxy.conf.json                      # Proxy de desarrollo
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
│
├── README.md                            # ✅ ACTUALIZADO
├── HALLAZGOS_Y_ANALISIS.md              # ✅ NUEVO — auditoría técnica
├── MATRIZ_ROLES.md                      # ✅ NUEVO — permisos por rol
├── ESTRUCTURA_PROYECTO.md               # ✅ NUEVO — este documento
├── README_REFACTOR_VENTAS.md
├── BUG_DASHBOARD_CARDS_CORREGIDO.md
├── BUG_DASHBOARD_CARDS_ADMIN_SUPERVISOR_CORREGIDO.md
├── BUG_CARDS_DIARIAS_ADMIN_SUPERVISOR_AJUSTADO.md
├── BUG_TABLA_SUPERVISOR_CORREGIDO.md
└── CORRECCION_FILTRO_CATEGORIAS_PROVEEDOR.md
```

---

## 📁 `src/app/` Detallado

### Raíz

```
src/app/
├── app.ts                  # Componente raíz (router-outlet, registra última ruta)
├── app.config.ts           # Providers: router, http, interceptors
└── app.routes.ts           # Rutas con lazy loading + RoleGuard
```

---

### `core/` — Lógica central (singleton, no UI)

```
core/
├── api/
│   └── dashboard.api.ts                    # Servicio genérico /api/dashboard/*
│
├── auth/
│   ├── roles.ts                            # RoleId enum, constantes DASHBOARD/ADMIN/ANALISIS_ROLES
│   └── menu-items.ts                       # MENU_ITEMS + interface MenuItem
│
├── guards/
│   ├── auth.guard.ts                       # ⚠️ NO USADO (lógica cubierta por role.guard)
│   ├── role.guard.ts                       # ✅ Usado: valida isLoggedIn + roles + inicia timer
│   └── login.guard.ts                      # ✅ Usado: solo previene acceso si ya hay sesión
│
├── interceptors/
│   └── auth.interceptor.ts                 # ✅ JwtInterceptor funcional, 401/403 → logout
│
├── models/
│   ├── cliente.model.ts
│   ├── item.model.ts
│   ├── paginacion.model.ts
│   ├── vendedor.model.ts
│   └── vendedor-items-response.model.ts
│
└── services/
    ├── auth.service.ts                     # login, logout, sesión, inactividad, sync pestañas
    ├── session.service.ts                  # almacenamiento + nonce + auth_event
    ├── supervisor-cache.service.ts         # cache de supervisores
    ├── usuarios.service.ts                 # CRUD usuarios + asignar supervisor
    ├── proveedor.service.ts
    ├── cuotas-upload.service.ts            # upload + delete de cuotas
    │
    ├── ventas/
    │   ├── cumplimientoVentasMes.service.ts   # cache por filtros
    │   ├── cumplimientoVentasSemana.service.ts
    │   └── cuotaDia.service.ts                # cuota diaria por rol
    │
    ├── impactos/
    │   └── impactos.service.ts
    │
    └── devoluciones/
        └── devoluciones.service.ts
```

---

### `shared/` — Componentes reutilizables (sin lógica de negocio)

```
shared/
├── components/
│   ├── topbar/
│   │   ├── topbar.component.ts             # Header compartido
│   │   ├── topbar.component.html
│   │   └── topbar.component.css
│   │
│   ├── sidebar/
│   │   ├── sidebar.component.ts            # Menú lateral, filtra por rol
│   │   ├── sidebar.component.html
│   │   └── sidebar.component.css
│   │
│   ├── card/
│   │   └── card.component.ts               # KPI card reusable
│   │
│   ├── chart/
│   │   ├── chart.component.ts              # Wrapper de Chart.js
│   │   └── index.ts
│   │
│   ├── filters/
│   │   └── filters.component.ts            # Filtros globales (DashboardFilters)
│   │
│   └── table/
│       └── table.component.ts              # Tabla genérica
│
├── pipes/                                  # (vacío o no indexado)
└── utils/                                  # (vacío o no indexado)
```

---

### `features/` — Funcionalidades de negocio (lazy loaded)

```
features/
│
├── login/
│   ├── login.component.ts                  # OnPush, validación, lockout
│   ├── login.component.html
│   └── login.component.css                 # Responsive fullscreen en móvil
│
├── dashboard/                              # ⚠️ Componente raíz muy grande (~1900 líneas)
│   ├── dashboard.component.ts              # Carga datos, filtros, sincroniza
│   ├── dashboard.html
│   ├── dashboard.css
│   │
│   ├── views/                              # Vistas por rol
│   │   ├── index.ts
│   │   ├── dashboard-role-views.module.ts
│   │   │
│   │   ├── administrador/
│   │   │   └── administrador.component.ts   # ADMIN: cards globales + tabla
│   │   │
│   │   ├── supervisor/
│   │   │   └── supervisor.component.ts     # SUPERVISOR: cards filtradas por equipo
│   │   │
│   │   └── shared/
│   │       └── vendedores-table/
│   │           └── vendedores-table.component.ts   # Tabla usada por SUPERVISOR y gestión
│   │
│   └── components/
│       ├── ventas/                         # 🟢 Refactor reciente por intención
│       │   ├── ventas.component.ts
│       │   ├── ui/
│       │   │   ├── ventas-tabs.component.ts
│       │   │   ├── ventas-tabla-grafica.component.ts
│       │   │   └── ventas-clientes-detalle.component.ts
│       │   ├── config/
│       │   │   └── ventas-view.config.ts
│       │   ├── models/
│       │   │   └── ventas.model.ts
│       │   ├── services/
│       │   │   ├── ventas-estado-base.ts
│       │   │   ├── ventas-transformaciones-base.ts
│       │   │   ├── ventas-utilidades-base.ts
│       │   │   └── ventas-clientes-base.ts
│       │   └── roles/
│       │       ├── administrador/ventas-administrador-base.ts
│       │       ├── supervisor/ventas-supervisor-base.ts
│       │       └── vendedor/ventas-vendedor-base.ts
│       │
│       ├── devoluciones/
│       │   └── devoluciones.component.ts
│       │
│       └── impactos/
│           └── impactos.component.ts
│
├── carga/                                  # Carga de datos (solo ADMIN)
│   ├── carga.component.ts                  # ⚠️ Solo re-exporta el de carga-ventas/
│   │
│   ├── carga-ventas/
│   │   └── carga.component.ts              # Upload .txt, preview, delete por fechas
│   │
│   └── carga-cuotas/
│       ├── carga-cuotas.component.ts       # Orquesta 3 tipos de cuotas
│       │
│       ├── cuota-vendedor-upload/
│       │   └── cuota-vendedor-upload.component.ts
│       │
│       ├── cuota-proveedor-upload/
│       │   └── cuota-proveedor-upload.component.ts
│       │
│       └── cuota-categoria-upload/
│           └── cuota-categoria-upload.component.ts
│
├── gestion-usuarios/                       # CRUD usuarios (solo ADMIN)
│   └── gestion-usuarios.component.ts       # Crear/editar/activar, asignar supervisor
│
├── vendedor-items/                         # Detalle por cliente (ADMIN + SUPERVISOR)
│   ├── vendedor-items.routes.ts
│   ├── pages/
│   │   └── vendedor-items-page/
│   │       └── vendedor-items-page.component.ts
│   └── components/
│       ├── vendedor-card/
│       │   └── vendedor-card.component.ts
│       └── cliente-card/
│           └── cliente-card.component.ts
│
└── cumplimientos-cuota/                    # Componente compartido
    └── cumplimientos.component.ts          # CuotasCumplimientoComponent + TipoCuota
```

---

## 🔗 Dependencias entre módulos

```
                ┌────────────────┐
                │     app.ts     │
                │  (router-out)  │
                └────────┬───────┘
                         │
                ┌────────▼────────┐
                │   app.routes    │
                │  (RoleGuard)    │
                └────────┬────────┘
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
  ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
  │  login  │       │dashboard│       │ carga / │
  │         │       │         │       │ gestion │
  └────┬────┘       └────┬────┘       └────┬────┘
       │                 │                 │
       │                 │   usa shared/   │
       │                 │   - topbar      │
       │                 │   - sidebar     │
       │                 │   - card        │
       │                 │   - chart       │
       │                 │   - filters     │
       │                 │   - table       │
       │                 │                 │
       └──── usa core/ ──┴──── usa core/ ─┘
              - services
              - guards
              - interceptor
              - auth
              - models
```

---

## 📊 Métricas de Código (junio 2026)

| Categoría | Archivos | Líneas aproximadas |
|-----------|---------:|-------------------:|
| Servicios (`core/services/`) | 13 | ~2.500 |
| Guards / Interceptors | 4 | ~250 |
| Componentes shared | 6+ | ~2.000 |
| Componentes features | 25+ | ~7.000 |
| Modelos / Interfaces | 5 | ~150 |
| Estilos globales (`styles.css`) | 1 | ~1.700 |
| **Total TypeScript app** | **~60** | **~14.000** |

> **Nota**: `dashboard.component.ts` tiene ~1.900 líneas — es el archivo más grande y se beneficiaría de un refactor para extraer sub-componentes o usar `dashboard-role-views.module.ts` como punto de entrada modular.

---

## 🎨 Assets y Recursos

```
public/
├── favicon.ico                # Ícono del navegador
├── logoDulces.png             # Logo en login y topbar
└── infa2.png                  # Imagen de fondo del brand panel del login
```

Cargados con `ngSrc` (`NgOptimizedImage`) en `LoginComponent` y `TopbarComponent`.

---

## ⚙️ Configuración de Entornos

```
src/environments/
├── environment.ts            # development (apiUrl: http://localhost:3000)
└── (falta environment.prod.ts) ⚠️ Ver HALLAZGOS_MEJORA-6
```

Configuración por defecto:

```ts
{
  production: false,
  apiUrl: 'http://localhost:3000',
  adminVentasUrl: 'http://localhost:3000',
  authValidationPath: '/api/auth/me',
}
```

---

## 🚀 Patrones y Convenciones Detectadas

- **Standalone components** en todos los archivos (no hay `NgModule` excepto `dashboard-role-views.module.ts`).
- **Lazy loading** con `loadComponent` para componentes individuales y `loadChildren` para `vendedor-items`.
- **`RoleGuard` con `data.roles`** centralizados en `core/auth/roles.ts`.
- **`HttpInterceptorFn`** (funcional) en lugar de clase.
- **Cache con `shareReplay`** en `CumplimientoService`, `CuotaDiaService` y `UsuariosService`.
- **Suscripciones con `Subject + takeUntil(destroy$)`** (modernizable a `takeUntilDestroyed`).
- **Sin `OnPush`** salvo en `LoginComponent`.
- **Sin tests** `*.spec.ts` aunque Vitest está configurado.
- **Tipado fuerte ausente** en `UsuariosService` y `GestionUsuariosComponent` (mucho `any`).
- **Estilos**: mix de variables CSS (`styles.css`), estilos scoped por componente y media queries propias. Tailwind importado pero poco usado en features nuevas.

---

**Versión del documento**: junio 2026.
