# Copilot instructions

## Comandos
- **Dev server:** `npm start`
- **Build producción:** `npm run build`
- **Build watch (dev):** `npm run watch`
- **Tests unitarios:** `npm test`
- **Un solo test:** `npm test -- --include src/app/ruta/al/test.spec.ts`

## Arquitectura (panorama general)
- **Angular standalone + routing centralizado:** la app arranca en `App` (standalone) y todo el enrutamiento vive en `src/app/app.routes.ts`, usando `loadComponent` para carga perezosa de features.
- **Separación por capas:** `src/app/core` concentra guards, interceptores y servicios de negocio; `src/app/features` contiene las pantallas/flows (dashboard, login, carga, gestión de usuarios, cumplimiento de cuota); `src/app/shared/components` agrupa componentes reutilizables (card, chart, filters, sidebar, table).
- **Dashboard por rol:** `features/dashboard/views` define vistas específicas por rol y se agrupan en `DashboardRoleViewsModule`, que el `DashboardComponent` consume según el rol del usuario.
- **API y autenticación:** la URL base sale de `environment.apiUrl`; el `authInterceptor` agrega `Authorization: Bearer` solo para el origen confiable y excluye login y el upload de cuotas.

## Convenciones clave del códigobase
- **Rutas con roles:** cuando una ruta es exclusiva de rol, se usa `canActivate: [RoleGuard]` y `data.roles` con IDs numéricos (por ejemplo, `1` para administrador).
- **Sesión centralizada:** el usuario autenticado se guarda y se consulta vía `SessionService`/`AuthService` (no leer `sessionStorage` directo). La clave de sesión es `vendedor`.
- **Componentes standalone con plantillas separadas:** los componentes usan `standalone: true` y mantienen `*.html`/`*.css` junto al `*.component.ts`.
