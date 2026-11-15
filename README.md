# ⏱️ Control de Horas — PWA de Fichaje y Gestión Salarial

Aplicación Web Progresiva (*mobile-first*) diseñada para el registro de jornadas laborales, control de horas extra y cálculo salarial automatizado en tiempo real. Construida con una interfaz de alto contraste estilo semáforo para agilizar la operativa diaria desde dispositivos móviles.

## 🚀 Características Principales

- **Fichaje Rápido (UI Semáforo):** Control intuitivo de entrada y salida con acumulador diario, reinicio automático a medianoche y selector de suplementos específicos (*Plus Buceo*).
- **Motor de Cálculo Salarial Configurable:**
  - Aplicación automática de **horas base mínimas garantizadas** por jornada.
  - Cálculo diferencial de **horas extra** y suplementos personalizados.
  - Redondeo monetario limpio y tarifas ajustables por usuario o jornada específica.
- **Calendario Interactivo:** Vista mensual con código de colores por tipo de jornada, desglose diario de horas/importe y modal de edición manual para corregir o añadir registros.
- **Informes Mensuales y Exportación:** Resumen detallado por columnas (días trabajados, horas base, horas extra, pluses y total devengado) con integración de **Web Share API** (envío directo por WhatsApp/Email) y generación de **PDF** optimizado para impresión.
- **Arquitectura Multiempresa y Roles:** Flujos diferenciados para perfiles de *Trabajador* y *Empresario*, con aislamiento de datos mediante identificador de empresa (`empresaId`).

## 🛠️ Stack Tecnológico

- **Frontend:** HTML5, CSS3 (Diseño responsivo *mobile-first* y estilos `@media print`), JavaScript (ES6+ Modules).
- **Backend / BaaS:** Firebase Authentication (gestión de sesión persistente) y Cloud Firestore (base de datos NoSQL en tiempo real).
- **Despliegue:** Preparada para alojarse como PWA estática (GitHub Pages / Firebase Hosting).

## 📂 Estructura del Proyecto

```text
├── css/
│   └── style.css          # Estilos globales, variables de tema oscuro y diseño responsivo
├── js/
│   ├── firebase-config.js # Inicialización y credenciales de Firebase
│   ├── auth.js            # Lógica de autenticación, registro y control de roles
│   ├── fichar.js          # Controlador principal de fichaje y temporizador diario
│   ├── calendario.js      # Renderizado mensual, reglas de negocio salarial y modal de edición
│   ├── ajustes.js         # Configuración de tarifas personalizadas y datos de perfil
│   ├── informe.js         # Agregación de métricas mensuales, Web Share API y exportación PDF
│   └── empresario.js      # Vista y gestión para perfiles de administración/empresa
├── index.html             # Acceso y registro de usuarios
├── fichar.html            # Panel principal de fichaje
├── calendario.html        # Vista de calendario y edición de jornadas
├── ajustes.html           # Configuración de tarifas y parámetros
└── informe.html           # Generador de informes mensuales
