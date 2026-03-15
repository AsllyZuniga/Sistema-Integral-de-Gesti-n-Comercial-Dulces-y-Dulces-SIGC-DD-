# 🍬 SIGC DD — Sistema Integral de Gestión Comercial
### Frontend · Dulces y Dulces S.A. · v1.0.0

<p align="center">
  <img src="src/assets/logoDulces.png" alt="Logo Dulces y Dulces" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-19-DD0031?style=for-the-badge&logo=angular&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Chart.js-Visualización-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/RxJS-Observables-B7178C?style=for-the-badge&logo=reactivex&logoColor=white" />
  <img src="https://img.shields.io/badge/Estado-En%20Desarrollo-yellow?style=for-the-badge" />
</p>

> Este repositorio contiene el **cliente web** del SIGC DD. Para el backend (API REST · Node.js · Express · PostgreSQL) consulta:
> 🔗 [API_Sistema_Integral_de_Gestion_Comercial_Dulces_y_Dulces_SIGC_DD](https://github.com/AsllyZuniga/API_Sistema_Integral_de_Gestion_Comercial_Dulces_y_Dulces_SIGC_DD)

---

## Tabla de Contenidos

1. [Descripción del Sistema](#descripción-del-sistema)
2. [Tecnologías Utilizadas](#tecnologías-utilizadas)
3. [Instalación y Configuración](#instalación-y-configuración)
4. [Estructura del Proyecto](#estructura-del-proyecto)
5. [Módulos Funcionales](#módulos-funcionales)
6. [Control de Roles](#control-de-roles)
7. [Endpoints Consumidos](#endpoints-consumidos)
8. [Colaboradores](#colaboradores)

---

## Descripción del Sistema

El **SIGC DD Frontend** es la interfaz web del Sistema Integral de Gestión Comercial de **Dulces y Dulces S.A.** Consume la API REST del backend y expone un dashboard interactivo para el monitoreo en tiempo real del desempeño comercial de la fuerza de ventas.

### ✅ Capacidades principales

- **Dashboard con KPIs en tiempo real**: Venta Acumulada, Cuota del Mes, Porcentaje de Cumplimiento y Proyección de Venta
- **Análisis de Ventas** con vistas por línea, ciudad, vendedor y detalle por ítem
- **Control de Impactos** agrupados por proveedor, ciudad y detalle de producto
- **Gestión de Devoluciones** con agrupación expandible por cliente, proveedor y ciudad
- **Filtros dinámicos globales** por rango de fechas, proveedor, categoría y ciudad — afectan todas las vistas y gráficas simultáneamente
- **Control de acceso por roles**: el rol 3 (Vendedor) accede a vistas restringidas; roles 1 y 2 tienen acceso completo
- **Gráficas interactivas** con Chart.js (barras, líneas y torta) con límite de altura responsivo
- **Sidebar colapsable** con soporte para menú móvil
- **Diseño responsivo** adaptado para escritorio, tablet y móvil
- **Anti-caché en peticiones HTTP** mediante timestamp `_t` para forzar datos frescos en cada consulta

---

## Tecnologías Utilizadas

| Capa | Tecnología | Versión | Uso |
|---|---|---|---|
| Framework | Angular | 19 | Arquitectura principal (standalone components) |
| Lenguaje | TypeScript | 5.x | Tipado estático y desarrollo |
| Gráficas | Chart.js | Latest | Visualizaciones de bar, line y pie |
| HTTP | Angular HttpClient + RxJS | — | Comunicación con la API REST |
| Formularios | Angular Forms (template-driven) | — | Filtros y controles del dashboard |
| Estilos | CSS Variables + Custom Design System | — | Temas, colores y tipografía |
| Iconos | Material Symbols Rounded | — | Iconografía del sistema |
| Tipografía | Plus Jakarta Sans | — | Fuente principal |
| Backend | SIGC DD API (Node.js · Express · PostgreSQL) | v1.0.0 | Fuente de datos |

---

## Instalación y Configuración

### Requisitos previos

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- **Angular CLI** ≥ 19.x
- **SIGC DD API** corriendo en `http://localhost:3000`
  → Ver instrucciones de instalación del backend en su [repositorio](https://github.com/AsllyZuniga/API_Sistema_Integral_de_Gestion_Comercial_Dulces_y_Dulces_SIGC_DD)

### 1. Clonar el repositorio

```bash
git clone https://github.com/dulces-y-dulces/SIGC-DD-Frontend.git
cd SIGC-DD-Frontend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar la URL del backend

En los servicios ubicados en `src/app/core/services/`, verificar que la URL base apunte al servidor correcto:

```typescript
// src/app/core/services/ventas/cumplimientoVentasMes.service.ts
private apiUrl = 'http://localhost:3000';
```

Para producción se recomienda usar `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000'
};
```

### 4. Ejecutar en desarrollo

```bash
ng serve
```

Disponible en: `http://localhost:4200`

### 5. Compilar para producción

```bash
ng build --configuration production
```

Salida generada en: `dist/`

---

## Estructura del Proyecto

```
src/
├── app/
│   ├── core/
│   │   └── services/
│   │       ├── auth.service.ts                        # Autenticación y sesión (localStorage)
│   │       ├── ventas/
│   │       │   └── cumplimientoVentasMes.service.ts   # Cumplimiento, líneas, ciudades, productos
│   │       ├── impactos/
│   │       │   └── impactos.service.ts                # Impactos por proveedor, ciudad y detalle
│   │       └── devoluciones/
│   │           └── devoluciones.service.ts            # Devoluciones por cliente, proveedor y ciudad
│   │
│   ├── shared/
│   │   └── components/
│   │       ├── card/                                  # Tarjetas KPI (Venta, Cuota, Cumplimiento, Proyección)
│   │       ├── table/                                 # Tabla genérica reutilizable con formateo COP
│   │       ├── chart/                                 # Gráfica genérica (Chart.js: bar, line, pie)
│   │       ├── filters/                               # Filtros globales del dashboard
│   │       └── sidebar/                               # Navegación lateral colapsable
│   │
│   └── features/
│       └── dashboard/
│           ├── dashboard.component.ts                 # Orquestador principal: KPIs, filtros, hijos
│           ├── dashboard.html
│           ├── dashboard.css
│           └── components/
│               ├── ventas/                            # Análisis de ventas
│               │   ├── ventas.component.ts
│               │   ├── ventas.html
│               │   └── ventas.css
│               ├── impactos/                          # Control de impactos
│               │   ├── impactos.component.ts
│               │   ├── impactos.component.html
│               │   └── impactos.component.css
│               └── devoluciones/                      # Gestión de devoluciones
│                   ├── devoluciones.component.ts
│                   ├── devoluciones.component.html
│                   └── devoluciones.component.css
│
├── assets/
│   └── logoDulces.png
│
└── environments/
    ├── environment.ts
    └── environment.prod.ts
```

---

## Módulos Funcionales

### Dashboard Principal
Orquesta todos los componentes hijos. Lee el vendedor autenticado desde `localStorage`, carga los KPIs globales y distribuye los filtros activos a cada sección.

### Análisis de Ventas
Vistas disponibles según rol:

| Vista | Descripción | Rol mínimo |
|---|---|---|
| Ventas | Gráfica de línea: Venta vs Cuota vs Proyección | 1 o 2 |
| Por Proveedor | Tabla de líneas con venta, cumplimiento y proyección | Todos |
| Por Ciudad | Tabla y gráfica de pie por ciudad | Todos |
| Por Vendedor | Datos de cumplimiento del vendedor activo | 1 o 2 |
| Detalle por Ítem | Tabla completa de productos con gráfica Top 10 | Todos |

### Control de Impactos
| Vista | Descripción |
|---|---|
| Por Proveedor | Impactos y valor total agrupados por proveedor |
| Por Ciudad | Impactos y valor total agrupados por ciudad |
| Detalle | Detalle por producto con Top 10 en gráfica |

### Gestión de Devoluciones
| Vista | Descripción |
|---|---|
| Por Cliente | Lista expandible de clientes con detalle de devoluciones |
| Por Proveedor | Devoluciones agrupadas por proveedor |
| Por Ciudad | Devoluciones agrupadas por ciudad |

### Filtros Globales
Afectan simultáneamente todas las secciones del dashboard:

| Filtro | Campo enviado al backend |
|---|---|
| Rango de fechas | `fechaInicio`, `fechaFin` |
| Proveedor | `proveedor` |
| Categoría | `categoria` |
| Ciudad | `ciudad` |

> Todas las peticiones incluyen el parámetro `_t` (timestamp) para evitar respuestas cacheadas.

---

## Control de Roles

La sesión se almacena en `localStorage` bajo la clave `vendedor`. El rol se lee desde `vendedor.rol.idRol`.

| Rol | ID | Acceso |
|---|---|---|
| Administrador | 1 | Acceso completo a todas las vistas y módulos |
| Supervisor | 2 | Acceso completo a todas las vistas y módulos |
| Vendedor | 3 | Vistas restringidas: Por Proveedor, Por Ciudad, Detalle por Ítem |

---

## Endpoints Consumidos

El frontend consume la [SIGC DD API](https://github.com/AsllyZuniga/API_Sistema_Integral_de_Gestion_Comercial_Dulces_y_Dulces_SIGC_DD). Todos los endpoints aceptan los query params: `fechaInicio`, `fechaFin`, `vendedor`, `proveedor`, `categoria`, `ciudad`, `_t`.

| Método | Endpoint | Descripción | Servicio |
|---|---|---|---|
| POST | `/api/auth/login` | Autenticación del vendedor | `AuthService` |
| GET | `/mes/cumplimiento/:codigo` | Cumplimiento general del vendedor | `CumplimientoService` |
| GET | `/mes/cumplimiento/vendedor/:codigo/lineas` | Desglose por línea | `CumplimientoService` |
| GET | `/mes/cumplimiento/vendedor/:codigo/linea/:linea` | Detalle de una línea específica | `CumplimientoService` |
| GET | `/mes/cumplimiento/vendedor/:codigo/ciudades` | Desglose por ciudad | `CumplimientoService` |
| GET | `/mes/cumplimiento/vendedor/:codigo/productos` | Detalle por ítem/producto | `CumplimientoService` |
| GET | `/impactos/proveedor` | Impactos agrupados por proveedor | `ImpactosService` |
| GET | `/impactos/ciudad` | Impactos agrupados por ciudad | `ImpactosService` |
| GET | `/impactos/detalle` | Detalle de impactos por producto | `ImpactosService` |
| GET | `/api/devoluciones/por-cliente` | Devoluciones agrupadas por cliente | `DevolucionesService` |
| GET | `/api/devoluciones/por-proveedor` | Devoluciones agrupadas por proveedor | `DevolucionesService` |
| GET | `/api/devoluciones/por-ciudad` | Devoluciones agrupadas por ciudad | `DevolucionesService` |

---

## Colaboradores

| Colaborador | GitHub | Rol |
|---|---|---|
| David Felipe Gustin Rivas | [@feliperivasdev](https://github.com/feliperivasdev) | Backend Developer |
| Aslly Ivonne Zuñiga | [@AsllyZuniga](https://github.com/AsllyZuniga) | Frontend Developer |

---

<p align="center">
  SIGC DD Frontend — © 2026 Dulces y Dulces S.A. · Todos los derechos reservados
</p>
