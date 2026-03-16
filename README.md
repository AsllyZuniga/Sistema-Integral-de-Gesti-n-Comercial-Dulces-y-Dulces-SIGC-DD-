# Sistema Integral de Gestión Comercial - Dulces y Dulces (SIGC-DD)

[![Angular](https://img.shields.io/badge/Angular-21.1.4-red.svg?style=flat-square&logo=angular)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-LTS-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-yellow.svg?style=flat-square)](#licencia)
[![Version](https://img.shields.io/badge/Version-1.0.0-brightgreen.svg?style=flat-square)](#)

## 📋 Descripción General

**SIGC-DD** es un sistema integral de gestión comercial diseñado específicamente para la empresa **Dulces y Dulces**. La aplicación proporciona herramientas profesionales para:

- 📊 **Dashboard Analítico**: Visualización en tiempo real de métricas comerciales
- 💰 **Gestión de Ventas**: Seguimiento de cumplimiento de objetivos mensuales
- 📉 **Control de Devoluciones**: Monitoreo de devoluciones de productos
- 🎯 **Análisis de Impactos**: Evaluación del impacto comercial
- 🔐 **Autenticación Multi-rol**: Sistema de usuarios con roles diferenciados (vendedores, supervisores, administradores)

## 🏗️ Arquitectura

La aplicación está construida bajo una arquitectura **standalone** moderna con Angular 21, implementando patrones SOLID y buenas prácticas de desarrollo:

```
src/
├── app/
│   ├── core/                 # Lógica central de la aplicación
│   │   ├── api/             # Servicios de API
│   │   ├── guards/          # Guards de autenticación y autorización
│   │   └── services/        # Servicios de negocio
│   ├── features/            # Módulos de características
│   │   ├── dashboard/       # Dashboard principal
│   │   ├── login/           # Autenticación
│   │   └── carga/           # Gestión de carga de datos
│   └── shared/              # Componentes y servicios compartidos
│       └── components/      # Componentes reutilizables
├── assets/                  # Recursos estáticos
└── styles.css              # Estilos globales (Tailwind CSS)
```

## ⚙️ Stack Tecnológico

| Tecnología | Versión | Propósito |
|-----------|---------|----------|
| **Angular** | 21.1.4 | Framework principal |
| **TypeScript** | 5.9.2 | Lenguaje de programación |
| **RxJS** | 7.8.0 | Programación reactiva |
| **Chart.js** | 4.5.1 | Visualización de datos |
| **Tailwind CSS** | 4.1.18 | Estilos y diseño responsivo |
| **Vitest** | 4.0.8 | Testing unitario |
| **Angular CLI** | 21.1.4 | Herramientas de desarrollo |

## 🚀 Instalación y Configuración

### Requisitos Previos

- **Node.js**: v18 o superior
- **npm**: v9 o superior

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tuusuario/Sistema-Integral-de-Gesti-n-Comercial-Dulces-y-Dulces-SIGC-DD-.git

# 2. Navegar al directorio del proyecto
cd Sistema-Integral-de-Gesti-n-Comercial-Dulces-y-Dulces-SIGC-DD-

# 3. Instalar dependencias
npm install

# 4. Iniciar servidor de desarrollo
npm start
```

## 🛠️ Comandos Disponibles

### Desarrollo

```bash
# Iniciar servidor de desarrollo
npm start
# Abre http://localhost:4200/ en el navegador
```

### Build

```bash
# Compilar para producción
npm run build
# Los artefactos se almacenan en el directorio dist/

# Build en modo watch
npm run watch
```

### Testing

```bash
# Ejecutar tests unitarios (Vitest)
npm test
```

### Angular CLI

```bash
# Ver lista completa de comandos
npm run ng -- --help

# Generar nuevo componente
npm run ng -- generate component nombre-componente

# Generar servicio
npm run ng -- generate service nombre-servicio
```

## 📱 Características Principales

### 🔑 Autenticación y Control de Acceso

- Sistema de login seguro
- Autenticación basada en credenciales (código de vendedor o username)
- Integración con API externa (sisferahub.com)
- Guards de ruta para protección de componentes
- Control de acceso basado en roles (RBAC)

### 📊 Dashboard

El dashboard central proporciona un resumen visual de:

- **Cumplimiento de Ventas**: Gráficos de línea y barras mostrando desempeño mensual
- **Devoluciones**: Monitoreo de tasas de devolución
- **Impactos Comerciales**: Análisis de variables críticas
- **Filtros Dinámicos**: Posibilidad de filtrar por fecha, vendedor, región, etc.

### 🧩 Componentes Clave

| Componente | Descripción |
|-----------|-----------|
| **Dashboard** | Vista principal con métricas consolidadas |
| **VentasComponent** | Gráficos de cumplimiento de ventas mensuales |
| **DevolucionesComponent** | Análisis de devoluciones de productos |
| **ImpactosComponent** | Evaluación de impactos comerciales |
| **Filters** | Sistema de filtrado avanzado |
| **Sidebar** | Navegación lateral |
| **Chart** | Componente reutilizable para gráficos |
| **Card** | Componente de tarjeta para métricas |
| **Table** | Componente para visualización tabular |

### 🔌 Servicios

- **AuthService**: Gestión de autenticación y sesion
- **CumplimientoVentasService**: Datos de cumplimiento de ventas
- **DevolucionesService**: Gestión de devoluciones
- **ImpactosService**: Análisis de impactos
- **DashboardAPI**: Llamadas a API para datos del dashboard

## 🔐 Seguridad

- **Guards de Ruta**: Protección de componentes mediante autenticación
- **Local Storage**: Almacenamiento seguro de sesión
- **HTTPS**: Comunicación encriptada con API
- **Control de Roles**: Sistema de autorización basado en roles

## 📦 Estructura de Módulos

```
Feature                Module              Componentes
├── Authentication    → LoginComponent    → Formulario de login
├── Dashboard        → DashboardModule   → Ventas, Devoluciones, Impactos
├── Data Management  → CargaComponent    → Carga de datos
└── Navigation       → SidebarComponent  → Menú lateral
```

## 🎨 Estilos y Diseño

- **Framework CSS**: Tailwind CSS 4.1.18
- **Responsive Design**: Totalmente responsivo para dispositivos móviles y desktop
- **Configuración PostCSS**: Incluida para procesamiento avanzado
- **Prettier**: Formateo automático de código HTML

## 📊 Visualización de Datos

La aplicación utiliza **Chart.js** para:

- Gráficos de línea (tendencias de ventas)
- Gráficos de barras (comparativas)
- Gráficos de área (acumulativos)
- Dashboards interactivos y dinámicos

## 🧪 Testing

```bash
# Ejecutar suite de tests
npm test

# Tests unitarios con Vitest
# Cubiertos: servicios, componentes, guards, pipes
```

## 📚 Documentación de API

**Base URL**: `https://api.sisferahub.com/api`

### Endpoints Principales

```
POST /auth/login              → Autenticación de usuarios
GET  /dashboard              → Datos del dashboard
GET  /ventas/cumplimiento    → Cumplimiento de ventas
GET  /devoluciones           → Datos de devoluciones
GET  /impactos               → Análisis de impactos
```

Para más detalles, consultar la documentación de la API externa.

## 🚦 Estado del Proyecto

| Aspecto | Estado |
|--------|--------|
| Desarrollo | ✅ Completo |
| Testing | ✅ Implementado |
| Documentación | ✅ Completa |
| Production Ready | ✅ Listo para producción |

## 🤝 Contribución

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📋 Convenciones de Código

- **TypeScript**: Generación de componentes con tipado estricto
- **Angular**: Componentes standalone y lazy loading
- **Nombres**: camelCase para variables/métodos, PascalCase para clases
- **Comentarios**: JSDoc para funciones públicas
- **Formato**: Prettier con printWidth: 100

## 🐛 Reporte de Bugs

Para reportar bugs, abre un issue en el repositorio con:

- Descripción clara del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si es aplicable

## 📝 Changelog

### v1.0.0 - Primera Versión Estable (2026-03-15)

**Features:**
- ✅ Sistema completo de autenticación multirol
- ✅ Dashboard principal con métricas consolidadas
- ✅ Componentes de ventas, devoluciones e impactos
- ✅ Integración con API externa (sisferahub.com)
- ✅ Sistema de filtros avanzados
- ✅ Visualización de datos con Chart.js
- ✅ Diseño responsivo con Tailwind CSS

**Improvements:**
- ✅ Arquitectura standalone de Angular
- ✅ Código modular y reutilizable
- ✅ Guards de autenticación y autorización
- ✅ Servicios reactivos con RxJS

## 📄 Licencia

Este proyecto es **software propietario**. Todos los derechos reservados a Dulces y Dulces.

## 👥 Autores

**Aslly Zuñiga** - Desarrolladora Frontend
**Felipe Rivas** - Desarrollador Backend

## 📞 Contacto y Soporte

Para preguntas o soporte técnico:

- 💬 Issues: [GitHub Issues](https://github.com/tuusuario/SIGC-DD/issues)
- 📖 Wiki: [GitHub Wiki](https://github.com/tuusuario/SIGC-DD/wiki)

---

## 🎯 Roadmap Futuro

- [ ] Integración con más módulos de gestión
- [ ] Reportes avanzados exportables (PDF/Excel)
- [ ] Sistema de notificaciones en tiempo real
- [ ] Mobile app nativa
- [ ] Soporte multi-idioma
- [ ] Análisis predictivo con ML

---

**Versión**: 1.0.0  
**Última actualización**: 15 de marzo de 2026  
**Estado**: 🟢 Producción
