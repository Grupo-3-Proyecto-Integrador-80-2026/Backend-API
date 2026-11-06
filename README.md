# Backend API — Salón de Estudio Colaborativo en Tiempo Real

API REST desacoplada desarrollada con **Node.js, TypeScript y Express 5** para la plataforma del Proyecto Integrador I (Grupo 3). Este servicio gestiona la lógica del negocio, la seguridad mediante Firebase Admin SDK y la persistencia en Cloud Firestore.

---

## 🛠️ Tecnologías

- **Lenguaje y Entorno:** Node.js (v22 LTS) y TypeScript
- **Framework Web:** Express 5
- **Seguridad y Base de Datos:** Firebase Authentication (Admin SDK) y Cloud Firestore (NoSQL)
- **Validación de Esquemas:** Zod
- **Documentación de API:** Swagger / OpenAPI 3.0 (`swagger-ui-express` y `swagger-jsdoc`)
- **Contenerización y Despliegue:** Docker, Docker Compose y Render

---

## 📋 Requisitos Previos

- **Node.js:** v20.0.0 o superior (recomendado v22 LTS)
- **npm:** v10.0.0 o superior
- **Docker y Docker Compose:** v24.0 o superior (para ejecución contenerizada)
- **Git**
- Archivo de credenciales de Firebase Admin SDK (`serviceAccountKey.json`)

---

## ⚙️ Variables de Entorno

Crea el archivo `.env` en la raíz del proyecto basándote en la plantilla `.env.example`:

```bash
cp .env.example .env
```

Contenido base del archivo `.env`:

```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./credentials/serviceAccountKey.json
```

### Configuración de Credenciales de Firebase

1. Solicita al administrador del proyecto la clave de servicio de Firebase Admin SDK.
2. Crea la carpeta `credentials/` en la raíz de `Backend-API`.
3. Guarda el archivo como `serviceAccountKey.json` dentro de esa carpeta.
4. Verifica que `credentials/` y `.env` se encuentren en el archivo `.gitignore` para no subir información sensible al repositorio remoto.

---

## 🚀 Ejecución en Modo Local (Desarrollo)

1. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor en modo desarrollo (recarga automática con `tsx watch`):**
   ```bash
   npm run dev
   ```

3. **Verificar tipado y compilar a JavaScript (TypeScript Build):**
   ```bash
   npm run build
   ```

4. **Ejecutar la versión compilada:**
   ```bash
   npm start
   ```

El servidor quedará disponible en: `http://localhost:3000`.

---

## 🐳 Ejecución con Docker

### Opción A: Levantar únicamente el contenedor de la API

1. **Construir la imagen de Docker del backend:**
   ```bash
   docker build -t backend-api .
   ```

2. **Ejecutar el contenedor montando las credenciales locales:**
   ```bash
   docker run -d -p 3000:3000 \
     -v $(pwd)/credentials:/app/credentials:ro \
     -e PORT=3000 \
     -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/serviceAccountKey.json \
     --name backend-container backend-api
   ```

3. **Detener y remover el contenedor:**
   ```bash
   docker stop backend-container && docker rm backend-container
   ```

---

### Opción B: Orquestación Completa con Docker Compose (Frontend + Backend)

Para levantar **todo el sistema integrado** con un solo comando, asegúrate de tener clonados ambos repositorios como carpetas hermanas (al mismo nivel):

```text
directorio-de-trabajo/
├── Backend-API/
│   ├── docker-compose.yml
│   └── Dockerfile
└── Frontend-Collaborative-study-room-platform/
    └── Dockerfile
```

1. **Ubicarse en la raíz del backend:**
   ```bash
   cd Backend-API
   ```

2. **Construir y levantar todos los servicios:**
   ```bash
   docker compose up --build
   ```

3. **Acceso a los servicios desplegados localmente:**
   - **Backend API & Swagger:** [http://localhost:3000](http://localhost:3000) | [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
   - **Frontend Web App:** [http://localhost:8080](http://localhost:8080)

4. **Detener la ejecución completa:**
   ```bash
   docker compose down
   ```

---

## 📡 Endpoints Principales

| Método | Endpoint | Descripción | Acceso | Historia Técnica |
|---|---|---|---|---|
| `GET` | `/api/health` | Estado de salud y actividad del servidor | Público | Monitoreo |
| `GET` | `/api/test/firebase` | Verificación síncrona de conexión con Firestore (`users`) | Público | TS-00 (Sprint 0) |
| `GET` | `/api-docs` | Documentación interactiva Swagger UI | Público | TS-00 / TS-01 |
| `GET` | `/api/protected` | Verificación de token JWT de Firebase Auth | Autenticado | TS-01 (Sprint 1) |
| `GET` | `/api/users/me` | Consulta del perfil del usuario autenticado | Autenticado | TS-01 / US-04 |
| `GET` | `/api/users` | Listado general de usuarios registrados | Solo Admin | Administración |

---

## 🔐 Autenticación

Las rutas protegidas requieren un token de identidad emitido por Firebase Authentication enviado mediante el encabezado HTTP Authorization:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

---

## 📖 Documentación Swagger / OpenAPI

La documentación interactiva de la API está disponible en:

- **Local:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Producción (Render):** [https://backend-api-grupo3.onrender.com/api-docs](https://backend-api-grupo3.onrender.com/api-docs)

Desde Swagger UI se pueden inspeccionar los esquemas y ejecutar pruebas directamente sobre el servidor tanto en local como en producción.

---

## 🏗️ Arquitectura por Capas

El backend implementa una separación estricta de responsabilidades:

- **`config/`**: Inicialización de Firebase Admin SDK y configuración de Swagger.
- **`routes/`**: Definición y enrutamiento de endpoints HTTP.
- **`controllers/`**: Procesamiento de peticiones, códigos de estado y respuestas HTTP.
- **`services/`**: Lógica de negocio y orquestación de operaciones.
- **`repositories/`**: Acceso directo y consultas a las colecciones de Cloud Firestore.
- **`middlewares/`**: Validación de esquemas, verificación de tokens JWT, control de roles y manejo global de errores.
- **`validators/`**: Esquemas de validación de entrada implementados con Zod.

---