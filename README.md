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
6. [Control de Roles y Acceso](#control-de-roles-y-acceso)
7. [Carga de Archivos de Ventas](#carga-de-archivos-de-ventas)
8. [Endpoints Consumidos](#endpoints-consumidos)
9. [Colaboradores](#colaboradores)

---

## Descripción del Sistema

El **SIGC DD Frontend** es la interfaz web del Sistema Integral de Gestión Comercial de **Dulces y Dulces S.A.** Consume la API REST del backend y expone un dashboard interactivo para el monitoreo en tiempo real del desempeño comercial de la fuerza de ventas.

### ✅ Capacidades principales

- **Dashboard con KPIs en tiempo real**: Venta Acumulada, Cuota del Mes, Porcentaje de Cumplimiento y Proyección de Venta
- **Análisis de Ventas** con vistas por línea, ciudad, vendedor y detalle por ítem
- **Control de Impactos** agrupados por proveedor, ciudad y detalle de producto
- **Gestión de Devoluciones** con agrupación expandible por cliente, proveedor y ciudad
- **Filtros dinámicos globales** por rango de fechas, proveedor, categoría y ciudad
- **Carga de archivos de ventas** — importación de planos TSV/TXT desde el ERP directamente desde el navegador
- **Control de acceso por roles** con guards de autenticación y autorización por nivel
- **Navegación lateral** con visibilidad de opciones según rol del usuario autenticado
- **Gráficas interactivas** con Chart.js (barras, líneas y torta) con altura responsiva controlada
- **Sidebar colapsable** con soporte para menú móvil y tooltips
- **Diseño responsivo** adaptado para escritorio, tablet y móvil
- **Anti-caché en peticiones HTTP** mediante timestamp `_t` para garantizar datos frescos

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
│   │   ├── guards/
│   │   │   ├── auth.guard.ts          # Verifica sesión activa
│   │   │   ├── login.guard.ts         # Redirige si ya está autenticado
│   │   │   └── role.guard.ts          # Verifica rol requerido por ruta
│   │   └── services/
│   │       ├── auth.service.ts                        # Autenticación y sesión (localStorage)
│   │       ├── ventas/
│   │       │   └── cumplimientoVentasMes.service.ts   # Cumplimiento, líneas, ciudades, productos
│   │       ├── impactos/
│   │       │   └── impactos.service.ts                # Impactos (pendiente backend)
│   │       └── devoluciones/
│   │           └── devoluciones.service.ts            # Devoluciones (pendiente backend)
│   │
│   ├── shared/
│   │   └── components/
│   │       ├── card/                                  # Tarjetas KPI
│   │       ├── table/                                 # Tabla genérica con formateo COP
│   │       ├── chart/                                 # Gráfica genérica (Chart.js)
│   │       ├── filters/                               # Filtros globales del dashboard
│   │       └── sidebar/                               # Navegación lateral con control de roles
│   │
│   └── features/
│       ├── login/                                     # Pantalla de autenticación
│       ├── dashboard/
│       │   ├── dashboard.component.ts                 # Orquestador principal
│       │   ├── dashboard.html
│       │   ├── dashboard.css
│       │   └── components/
│       │       ├── ventas/                            # Análisis de ventas
│       │       ├── impactos/                          # Control de impactos
│       │       └── devoluciones/                      # Gestión de devoluciones
│       └── carga/
│           ├── carga.component.ts                     # Módulo de carga de archivos TSV/TXT
│           ├── carga.component.html
│           └── carga.component.css
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
Orquesta todos los componentes hijos. Lee el vendedor autenticado desde `localStorage`, carga los KPIs globales y distribuye los filtros activos a cada sección. Implementa debounce de 100ms en las peticiones para evitar cancelaciones por actualizaciones simultáneas de `@Input`.

### Análisis de Ventas

| Vista | Descripción | Rol mínimo |
|---|---|---|
| Ventas | Gráfica de línea: Venta vs Cuota vs Proyección | 1 o 2 |
| Por Proveedor | Tabla de líneas con venta, cumplimiento y proyección | Todos |
| Por Ciudad | Tabla y gráfica de torta por ciudad | Todos |
| Por Vendedor | Datos de cumplimiento del vendedor activo | 1 o 2 |
| Detalle por Ítem | Tabla completa de productos con gráfica Top 10 | Todos |

### Control de Impactos
> ⏸️ Pendiente de implementación en el backend. Los componentes están listos — descomentar el servicio cuando los endpoints estén disponibles.

| Vista | Descripción |
|---|---|
| Por Proveedor | Impactos y valor total agrupados por proveedor |
| Por Ciudad | Impactos y valor total agrupados por ciudad |
| Detalle | Detalle por producto con Top 10 en gráfica |

### Gestión de Devoluciones
> ⏸️ Pendiente de implementación en el backend. Los componentes están listos — descomentar el servicio cuando los endpoints estén disponibles.

| Vista | Descripción |
|---|---|
| Por Cliente | Lista expandible de clientes con detalle de devoluciones |
| Por Proveedor | Devoluciones agrupadas por proveedor |
| Por Ciudad | Devoluciones agrupadas por ciudad |

### Filtros Globales
Afectan simultáneamente todas las secciones del dashboard. Las listas de proveedores y ciudades se cargan una sola vez al inicio para evitar bucles reactivos.

| Filtro | Campo enviado al backend |
|---|---|
| Rango de fechas | `fechaInicio`, `fechaFin` |
| Proveedor | `proveedor` |
| Categoría | `categoria` |
| Ciudad | `ciudad` |

> Todas las peticiones incluyen el parámetro `_t` (timestamp Unix) para evitar respuestas cacheadas (HTTP 304).

---

## Control de Roles y Acceso

La sesión del usuario se almacena en `localStorage` bajo la clave `vendedor`. El rol se lee desde `vendedor.rol.idRol`.

### Roles del sistema

| Rol | ID | Nivel de acceso |
|---|---|---|
| Administrador | 1 | Acceso completo — todas las vistas, módulos y carga de archivos |
| Supervisor | 2 | Acceso completo — todas las vistas, módulos y carga de archivos |
| Vendedor | 3 | Acceso restringido — solo vistas: Por Proveedor, Por Ciudad y Detalle por Ítem |

### Guards implementados

| Guard | Archivo | Función |
|---|---|---|
| `AuthGuard` | `auth.guard.ts` | Verifica que el usuario tenga sesión activa. Si no, redirige a `/login` |
| `LoginGuard` | `login.guard.ts` | Evita que un usuario autenticado acceda de nuevo al login |
| `RoleGuard` | `role.guard.ts` | Verifica que el rol del usuario esté en la lista `data.roles` de la ruta. Si no tiene permiso, redirige a `/dashboard` |

### Configuración de rutas

```typescript
{ path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
{ path: 'carga',     component: CargaComponent,     canActivate: [RoleGuard], data: { roles: [1, 2] } }
```

### Visibilidad en el sidebar por rol

| Opción | Rol 1 | Rol 2 | Rol 3 |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| Carga de Ventas | ✅ | ✅ | ❌ |
| Detalle | ✅ | ✅ | ✅ |
| Devoluciones | ✅ | ✅ | ✅ |
| Históricos | ✅ | ✅ | ✅ |
| Impactos | ✅ | ✅ | ✅ |
| Nivel Servicio | ✅ | ✅ | ✅ |

---

## Carga de Archivos de Ventas

El módulo de carga permite a administradores y supervisores importar el plano de ventas exportado del ERP directamente desde el navegador, sin necesidad de acceder al servidor.

### Acceso
- Ruta: `/carga`
- Roles permitidos: **Administrador (1)** y **Supervisor (2)**
- El rol Vendedor (3) no verá esta opción en el sidebar y será redirigido si intenta acceder por URL directa

### Flujo de uso

```
1. Ingresar a "Carga de Ventas" desde el sidebar
2. Seleccionar el archivo .txt / .tsv / .csv exportado del ERP
3. Verificar nombre y tamaño del archivo
4. Hacer clic en "Importar Ventas"
5. Esperar el procesamiento (puede tomar varios minutos en archivos grandes)
6. Revisar el resumen: registros exitosos, errores y tiempo total
```

### Endpoint utilizado

```
POST http://localhost:3000/import/ventas/upload
Content-Type: multipart/form-data

Campos:
  - archivo    : File   (archivo TSV/TXT)
  - batchSize  : string (tamaño de lote, por defecto 100)
```

### Respuesta esperada

```json
{
  "mensaje": "Importación completada exitosamente",
  "archivo": "ventas_febrero_2026.txt",
  "registrosExitosos": 52840,
  "registrosConError": 2,
  "tiempoTotalSegundos": "45.3"
}
```

### Consideraciones técnicas
- El timeout de la petición HTTP no está limitado — soporta archivos de hasta 6 GB
- La barra de progreso es animada (no refleja porcentaje real) ya que el backend no emite eventos de progreso por streaming
- Los errores de importación se muestran con el mensaje devuelto por el backend

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
| POST | `/import/ventas/upload` | Carga de archivo de ventas (multipart) | `CargaComponent` |
| GET | `/impactos/proveedor` | Impactos por proveedor *(pendiente backend)* | `ImpactosService` |
| GET | `/impactos/ciudad` | Impactos por ciudad *(pendiente backend)* | `ImpactosService` |
| GET | `/impactos/detalle` | Detalle de impactos *(pendiente backend)* | `ImpactosService` |
| GET | `/api/devoluciones/por-cliente` | Devoluciones por cliente *(pendiente backend)* | `DevolucionesService` |
| GET | `/api/devoluciones/por-proveedor` | Devoluciones por proveedor *(pendiente backend)* | `DevolucionesService` |
| GET | `/api/devoluciones/por-ciudad` | Devoluciones por ciudad *(pendiente backend)* | `DevolucionesService` |

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
