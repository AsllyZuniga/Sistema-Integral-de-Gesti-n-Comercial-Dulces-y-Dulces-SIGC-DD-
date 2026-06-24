# Sistema Integral de Gestión Comercial - Dulces y Dulces (SIGC-DD)

[![Angular](https://img.shields.io/badge/Angular-21.1.4-red.svg?style=flat-square&logo=angular)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-LTS-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-yellow.svg?style=flat-square)](#licencia)
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen.svg?style=flat-square)](#)

> Documentación consolidada y actualizada con el estado real del proyecto a junio 2026.

---

## 📋 Tabla de contenidos

1. [Descripción General](#-descripción-general)
2. [Estado del Proyecto](#-estado-del-proyecto)
3. [Arquitectura](#-arquitectura)
4. [Stack Tecnológico](#-stack-tecnológico)
5. [Roles y Permisos](#-roles-y-permisos)
6. [Funcionalidades por Rol](#-funcionalidades-por-rol)
7. [Instalación y Configuración](#-instalación-y-configuración)
8. [Comandos Disponibles](#-comandos-disponibles)
9. [Mapa de Rutas](#-mapa-de-rutas)
10. [Endpoints Principales](#-endpoints-principales)
11. [Documentación Adicional](#-documentación-adicional)
12. [Changelog](#-changelog)
13. [Licencia](#-licencia)

---

## 📋 Descripción General

**SIGC-DD** es el sistema integral de gestión comercial de la empresa **Dulces y Dulces**, una distribuidora comercial. La aplicación proporciona herramientas profesionales para la gestión de ventas, cumplimiento de cuotas, devoluciones e impactos, con autenticación multi-rol y dashboards diferenciados.

**Módulos principales:**

- 🔐 **Autenticación Multi-rol** (Administrador, Supervisor, Vendedor).
- 📊 **Dashboard Analítico** con cards KPI, gráficos y tablas por rol.
- 📈 **Cumplimiento de Ventas** (mensual, semanal, diario).
- 📉 **Control de Devoluciones**.
- 🎯 **Análisis de Impactos Comerciales**.
- 📁 **Carga de Ventas** desde archivos `.txt` del ERP (solo admin).
- 🎯 **Carga de Cuotas** (vendedor, proveedor/línea, categoría) con borrado por rango de fechas (solo admin).
- 👥 **Gestión de Usuarios** con creación, edición, activación/desactivación y asignación de supervisores (solo admin).
- 🔍 **Vendedor Items** con detalle por cliente y vendedor.

---

## ✅ Estado del Proyecto

| Aspecto | Estado | Notas |
|--------|--------|-------|
| Autenticación | ✅ Completo | Login con código o usuario, JWT, sesión persistente, multi-pestaña |
| Roles y Guards | ✅ Completo | 3 roles, `RoleGuard` en todas las rutas protegidas |
| Dashboard ADMIN | ✅ Completo | Cards, ventas, devoluciones, impactos, filtros, vendedor-items |
| Dashboard SUPERVISOR | ✅ Completo | Vendedores asignados, análisis de ventas filtrado |
| Dashboard VENDEDOR | ✅ Completo | Análisis de ventas propio, items por cliente |
| Carga de Ventas | ✅ Completo | Upload `.txt`, preview, borrado por fechas |
| Carga de Cuotas | ✅ Completo | Vendedor, proveedor, categoría con borrado por fechas |
| Gestión Usuarios | ⚠️ Parcial | Crear, editar, activar/desactivar. **Falta DELETE físico** |
| Sidebar dinámico | ✅ Completo | Items filtrados por rol desde `menu-items.ts` |
| Responsive | ✅ Completo | Mobile-first, sidebar drawer, tablas con scroll horizontal |
| Loading / Error / Empty | ✅ Completo | Estados visuales en todas las vistas |
| Build | ✅ Funciona | Errores de budgets preexistentes en `angular.json` |

Ver [HALLAZGOS_Y_ANALISIS.md](./HALLAZGOS_Y_ANALISIS.md) para el detalle técnico completo y los gaps detectados.

---

## 🏗️ Arquitectura

La aplicación está construida bajo una arquitectura **standalone** moderna con Angular 21, con separación clara de responsabilidades y lazy loading por feature.

```
src/app/
├── core/                              # Lógica central
│   ├── api/                           # Servicios de API genéricos
│   ├── auth/                          # Roles, menú, helpers
│   ├── guards/                        # auth.guard, role.guard, login.guard
│   ├── interceptors/                  # auth.interceptor (JWT)
│   ├── models/                        # Interfaces globales
│   └── services/                      # Servicios de negocio
│       ├── auth.service.ts
│       ├── session.service.ts
│       ├── usuarios.service.ts
│       ├── supervisor-cache.service.ts
│       ├── proveedor.service.ts
│       ├── cuotas-upload.service.ts
│       ├── ventas/                    # Cumplimiento mes / semana / cuota día
│       ├── impactos/
│       └── devoluciones/
│
├── shared/                            # Componentes reutilizables
│   ├── components/
│   │   ├── topbar/                    # Header compartido
│   │   ├── sidebar/                   # Menú lateral filtrado por rol
│   │   ├── card/                      # KPI card
│   │   ├── chart/                     # Gráfico con Chart.js
│   │   ├── filters/                   # Filtros globales del dashboard
│   │   └── table/                     # Tabla genérica
│   ├── pipes/
│   └── utils/
│
├── features/                          # Funcionalidades de negocio
│   ├── login/                         # Pantalla de login
│   ├── dashboard/                     # Dashboard principal
│   │   ├── views/
│   │   │   ├── administrador/         # Vista ADMIN
│   │   │   ├── supervisor/            # Vista SUPERVISOR
│   │   │   └── shared/                # Tabla vendedores compartida
│   │   └── components/
│   │       ├── ventas/                # Módulo ventas
│   │       │   ├── ui/                # Tabs, tabla-gráfica, clientes-detalle
│   │       │   ├── config/            # Configuración de vistas
│   │       │   ├── models/
│   │       │   ├── services/          # Estado, transformaciones, utilidades
│   │       │   └── roles/             # Lógica por rol
│   │       ├── devoluciones/
│   │       └── impactos/
│   ├── carga/                         # Carga de datos (solo admin)
│   │   ├── carga-ventas/              # Carga de ventas desde .txt
│   │   └── carga-cuotas/              # Carga de cuotas
│   │       ├── cuota-vendedor-upload/
│   │       ├── cuota-proveedor-upload/
│   │       └── cuota-categoria-upload/
│   ├── gestion-usuarios/              # CRUD de usuarios (solo admin)
│   ├── vendedor-items/                # Detalle por cliente y vendedor
│   └── cumplimientos-cuota/           # Componente compartido de cumplimiento
│
├── app.routes.ts                      # Rutas con lazy loading y RoleGuard
├── app.config.ts                      # Providers (router, http, interceptors)
└── app.ts                             # Componente raíz (router-outlet)
```

---

## ⚙️ Stack Tecnológico

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **Angular** | 21.1.4 | Framework principal (standalone) |
| **TypeScript** | 5.9.2 | Lenguaje de programación |
| **RxJS** | 7.8.0 | Programación reactiva |
| **Chart.js** | 4.5.1 | Visualización de datos |
| **Tailwind CSS** | 4.1.18 | Utilidades CSS (import en `styles.css`) |
| **Vitest** | 4.0.8 | Testing unitario |
| **Angular CLI** | 21.1.4 | Herramientas de desarrollo |

**Patrones aplicados:**

- Componentes `standalone` (sin `NgModule`).
- `ChangeDetectionStrategy.OnPush` en `LoginComponent` (otros usan default, ver HALLAZGOS).
- Lazy loading por feature con `loadComponent` / `loadChildren`.
- `HttpInterceptorFn` para JWT.
- `RoleGuard` funcional con `data.roles` en rutas.
- `BehaviorSubject` y `Subject` en `SessionService` para sincronización entre pestañas.

---

## 🔐 Roles y Permisos

Definidos en `src/app/core/auth/roles.ts`:

| Rol | ID | Descripción |
|-----|----|-----------|
| **ADMINISTRADOR** | 1 | Acceso total: dashboards, carga, gestión de usuarios, borrado de información |
| **SUPERVISOR** | 2 | Dashboards de su equipo, análisis, vendedor-items. **NO** carga ni gestión usuarios |
| **VENDEDOR** | 3 | Dashboard propio y vendedor-items. **NO** ve otros vendedores |

Ver matriz completa en [MATRIZ_ROLES.md](./MATRIZ_ROLES.md).

---

## 🧩 Funcionalidades por Rol

### 👑 Administrador (rol 1)

**Acceso total al sistema:**

- ✅ Dashboard con todas las métricas globales.
- ✅ Filtros globales (proveedor, categoría, vendedor, ciudad, línea, periodo).
- ✅ Análisis de impactos y devoluciones.
- ✅ **Carga de ventas** desde `.txt` con preview y progreso.
- ✅ **Borrado de ventas** por rango de fechas (`DELETE /api/admin/ventas`).
- ✅ **Carga de cuotas** (vendedor, proveedor, categoría).
- ✅ **Borrado de cuotas** por rango de fechas (proveedor y categoría).
- ✅ **Gestión de usuarios**: crear, editar, activar/desactivar, asignar supervisores.
- ✅ **Vendedor items**: detalle por cliente, histórico.
- ❌ **DELETE físico de usuarios** (gap detectado — ver HALLAZGOS).

### 🛡️ Supervisor (rol 2)

**Gestión de su equipo:**

- ✅ Dashboard filtrado por sus vendedores asignados.
- ✅ Sección "Vendedores Asignados".
- ✅ Análisis de ventas por ciudad, línea, proveedor, categoría.
- ✅ Vendedor items solo de su equipo.
- ❌ Carga de ventas/cuotas.
- ❌ Gestión de usuarios.
- ❌ Borrado de información.

### 🧑‍💼 Vendedor (rol 3)

**Solo su información:**

- ✅ Dashboard con sus propias ventas, cuotas, cumplimiento.
- ✅ Análisis de ventas personal (mensual, semanal, diario).
- ✅ Vendedor items (sus clientes y productos).
- ❌ No ve otros vendedores.
- ❌ No accede a carga ni gestión usuarios.
- ❌ No borra información.

---

## 🚀 Instalación y Configuración

### Requisitos Previos

- **Node.js**: v18 o superior.
- **npm**: v9 o superior.

### Pasos

```bash
# 1. Clonar
git clone https://github.com/tuusuario/SIGC-DD.git

# 2. Entrar al directorio
cd Sistema-Integral-de-Gesti-n-Comercial-Dulces-y-Dulces-SIGC-DD-

# 3. Instalar dependencias
npm install

# 4. Configurar API (opcional)
# Editar src/environments/environment.ts si el backend no está en localhost:3000
# apiUrl: 'http://localhost:3000'

# 5. Iniciar
npm start
# Abre http://localhost:4200/
```

---

## 🛠️ Comandos Disponibles

```bash
# Desarrollo
npm start                # ng serve → http://localhost:4200/

# Build
npm run build            # Producción → dist/
npm run watch            # Build en modo watch (development)

# Testing
npm test                 # ng test (Vitest)

# Linter
npm run ng -- lint       # Si está configurado

# Generadores
npm run ng -- generate component nombre
npm run ng -- generate service ruta/nombre
```

---

## 🗺️ Mapa de Rutas

Definido en `src/app/app.routes.ts`. Todas las rutas protegidas usan `RoleGuard` con `data.roles`.

| Ruta | Componente | Roles | Tipo |
|------|-----------|-------|------|
| `/` | redirect | — | → `/login` |
| `/login` | `LoginComponent` | público | canActivate: `LoginGuard` |
| `/dashboard` | `DashboardComponent` | 1, 2, 3 | canActivate: `RoleGuard` |
| `/impactos` | `ImpactosComponent` | 1, 2 | canActivate: `RoleGuard` |
| `/vendedor-items` | `vendedor-items.routes` | 1, 2 | canActivate: `RoleGuard` |
| `/carga` | `CargaComponent` (carga-ventas) | 1 | canActivate: `RoleGuard` |
| `/carga-cuotas` | `CargaCuotasComponent` | 1 | canActivate: `RoleGuard` |
| `/gestion-usuarios` | `GestionUsuariosComponent` | 1 | canActivate: `RoleGuard` |
| `/**` | redirect | — | → `/login` |

> Nota: el archivo `auth.guard.ts` existe pero **no se usa** en `app.routes.ts`. Solo se usa `RoleGuard` que ya cubre la validación de sesión (`isLoggedIn`). Ver [HALLAZGOS_Y_ANALISIS.md](./HALLAZGOS_Y_ANALISIS.md).

---

## 🔌 Endpoints Principales

**Base URL**: `http://localhost:3000` (configurable en `environment.ts`).

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (público) |
| GET | `/api/auth/me` | Validar sesión (cache 60s) |

### Carga de Ventas (ADMIN)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/import/ventas/upload` | Carga archivo `.txt` |
| GET | `/api/admin/ventas/preview` | Preview antes de borrar |
| DELETE | `/api/admin/ventas?fechaInicio&fechaFin` | Borrar ventas por rango |

### Carga de Cuotas (ADMIN)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/import/cuotas/upload` | Cargar cuotas vendedor |
| POST | `/api/vendedor-cuota-proveedor/upload` | Cargar cuotas proveedor |
| DELETE | `/api/vendedor-cuota-proveedor/rango/por-fechas` | Borrar cuotas proveedor |
| POST | `/api/cuota-categoria-import/cargar` | Cargar cuotas categoría |
| DELETE | `/api/vendedor-cuota-categoria/rango/por-fechas` | Borrar cuotas categoría |

### Gestión de Usuarios (ADMIN)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/usuario` | Listar usuarios |
| POST | `/api/usuario` | Crear usuario |
| PUT | `/api/usuario/{id}` | Actualizar / desactivar |
| GET | `/api/vendedor` | Listar detalle vendedores |
| POST | `/api/vendedor` | Crear vendedor |
| PUT | `/api/vendedor/{id}` | Actualizar vendedor |
| PUT | `/api/vendedor/{id}/asignar-supervisor` | Asignar supervisor |
| GET | `/api/vendedor/supervisor/{id}` | Vendedores del supervisor |
| **DELETE** | `/api/usuario/{id}` | ⚠️ **NO IMPLEMENTADO** (gap) |

### Dashboard

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/...` (varios) | Cumplimiento, impacto, devolución (por rol) |
| GET | `/api/cuota-dia/por-dia` | Cuota diaria ADMIN |
| GET | `/api/roles/cuota-dia/por-supervisor` | Cuota diaria SUPERVISOR |
| GET | `/api/roles/cuota-dia/por-vendedor` | Cuota diaria VENDEDOR |

Para más detalles ver `src/app/core/services/*`.

---

## 📚 Documentación Adicional

| Archivo | Descripción |
|---------|-------------|
| [HALLAZGOS_Y_ANALISIS.md](./HALLAZGOS_Y_ANALISIS.md) | **Reporte técnico completo**: gaps, mejoras, problemas de arquitectura |
| [MATRIZ_ROLES.md](./MATRIZ_ROLES.md) | Matriz detallada de permisos por rol |
| [ESTRUCTURA_PROYECTO.md](./ESTRUCTURA_PROYECTO.md) | Mapa detallado de carpetas y archivos |
| [docs/FRONTEND_REFACTOR_VENTAS.md](./docs/FRONTEND_REFACTOR_VENTAS.md) | Refactor del módulo de ventas |
| [README_REFACTOR_VENTAS.md](./README_REFACTOR_VENTAS.md) | Notas de refactor de ventas |
| [BUG_DASHBOARD_CARDS_CORREGIDO.md](./BUG_DASHBOARD_CARDS_CORREGIDO.md) | Bug fix cards dashboard |
| [BUG_DASHBOARD_CARDS_ADMIN_SUPERVISOR_CORREGIDO.md](./BUG_DASHBOARD_CARDS_ADMIN_SUPERVISOR_CORREGIDO.md) | Bug fix cards diarias |
| [BUG_CARDS_DIARIAS_ADMIN_SUPERVISOR_AJUSTADO.md](./BUG_CARDS_DIARIAS_ADMIN_SUPERVISOR_AJUSTADO.md) | Ajuste cards diarias |
| [BUG_TABLA_SUPERVISOR_CORREGIDO.md](./BUG_TABLA_SUPERVISOR_CORREGIDO.md) | Fix tabla supervisor |
| [CORRECCION_FILTRO_CATEGORIAS_PROVEEDOR.md](./CORRECCION_FILTRO_CATEGORIAS_PROVEEDOR.md) | Fix filtro categorías |

---

## 📝 Changelog

### v1.0.0 — Versión Estable (Junio 2026)

**Features:**
- ✅ Sistema de autenticación multi-rol (Administrador, Supervisor, Vendedor).
- ✅ Dashboards diferenciados por rol con cards, gráficos y tablas.
- ✅ Cumplimiento de ventas mensual, semanal y diario.
- ✅ Módulo de devoluciones e impactos.
- ✅ Carga de ventas desde `.txt` con progreso y preview.
- ✅ Carga de cuotas (vendedor, proveedor, categoría) con borrado por fechas.
- ✅ Gestión de usuarios con asignación de supervisores.
- ✅ Vendedor items con detalle por cliente.
- ✅ Sidebar y topbar compartidos.
- ✅ Sistema de filtros globales en dashboard.
- ✅ Diseño responsive (mobile, tablet, desktop).
- ✅ Sincronización de sesión entre pestañas.
- ✅ Timer de inactividad (1h) con auto-logout.
- ✅ Guards funcionales (`RoleGuard`).

**Mejoras recientes:**
- ✅ Refactor del módulo de ventas con separación por intención (config, models, services, ui, roles).
- ✅ Cards diarias corregidas para ADMIN, SUPERVISOR y VENDEDOR.
- ✅ Tabla de supervisores con `table-layout: fixed` para nombres largos.
- ✅ Filtro de categorías dinámico al cambiar proveedor.
- ✅ Login responsive sin bordes blancos en móvil.

**Pendientes (ver [HALLAZGOS_Y_ANALISIS.md](./HALLAZGOS_Y_ANALISIS.md)):**
- ⏳ DELETE físico de usuarios.
- ⏳ Refactor de `OnPush` en componentes de tablas.
- ⏳ Limpiar tipos `any` en servicios.
- ⏳ Eliminar `auth.guard.ts` o usarlo realmente.
- ⏳ Ajustar budgets de `angular.json` para producción.

---

## 👥 Autores

- **Aslly Zuñiga** — Desarrolladora Frontend.
- **Felipe Rivas** — Desarrollador Backend.

---

## 📄 Licencia

Software propietario. Todos los derechos reservados a **Dulces y Dulces**.

---

**Versión**: 1.0.0
**Última actualización**: Junio 2026
**Estado**: 🟢 Producción
