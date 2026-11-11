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

Las variables `VITE_FIREBASE_*` del `.env.example` solo se usan con Docker Compose: se le pasan al frontend al construirlo.

### Configuración de Credenciales de Firebase

1. Solicita al administrador del proyecto la clave de servicio de Firebase Admin SDK.
2. Crea la carpeta `credentials/` en la raíz de `Backend-API`.
3. Guarda el archivo como `serviceAccountKey.json` dentro de esa carpeta.
4. Verifica que `credentials/` y `.env` se encuentren en el archivo `.gitignore` para no subir información sensible al repositorio remoto.

### Configuración de Firebase Authentication (una sola vez, en Firebase Console)

1. **Authentication → Método de acceso:** habilitar **Correo electrónico/contraseña** y **Google**.
2. **Authentication → Configuración → Dominios autorizados:** agregar el dominio de Vercel del frontend.
3. **Firestore → Reglas:** publicar el contenido de [`firestore.rules`](firestore.rules), que niega todo acceso directo desde los clientes. La API usa el Admin SDK, que no está sujeto a esas reglas.

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

2. **Configurar el `.env`** (copiado de `.env.example`) con las variables `VITE_FIREBASE_*` de la app web de Firebase y la carpeta `credentials/` con la clave del Admin SDK. El frontend se construye apuntando a la API local (`http://localhost:3000`).

3. **Construir y levantar todos los servicios:**
   ```bash
   docker compose up --build
   ```

4. **Acceso a los servicios desplegados localmente:**
   - **Backend API & Swagger:** [http://localhost:3000](http://localhost:3000) | [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
   - **Frontend Web App:** [http://localhost:8080](http://localhost:8080)

5. **Detener la ejecución completa:**
   ```bash
   docker compose down
   ```

---

## 📡 Endpoints Principales

| Método | Endpoint | Descripción | Acceso | Historia |
|---|---|---|---|---|
| `GET` | `/api/health` | Estado del servidor | Público | Monitoreo |
| `GET` | `/api/test/firebase` | Verificación de conexión con Firestore (`users`) | Público | TS-00 |
| `GET` | `/api-docs` | Documentación interactiva Swagger UI | Público | TS-00 / TS-01 |
| `POST` | `/api/auth/register` | Crear cuenta con correo y contraseña (Auth + perfil en Firestore) | Público | TS-01 / US-01 |
| `GET` | `/api/users/username-availability?username=` | Consultar si un nombre de usuario está libre | Público | TS-01 / US-01 / US-02 |
| `GET` | `/api/users/me` | Perfil del usuario autenticado (404 `PROFILE_NOT_FOUND` si aún no elige nombre de usuario) | Autenticado | TS-01 / US-02 / US-03 |
| `POST` | `/api/users/me` | Completar el perfil después de «Continuar con Google» | Autenticado | TS-01 / US-02 |
| `GET` | `/api/protected` | Verificación del ID token de Firebase | Autenticado | TS-01 |
| `GET` | `/api/users` | Listado de usuarios | Solo Admin | Administración |

### Flujos de autenticación

- **Registro manual (US-01):** el frontend envía el formulario a `POST /api/auth/register`; la API crea la cuenta en Firebase Authentication y el perfil en Firestore. Luego el frontend inicia sesión con `signInWithEmailAndPassword`.
- **Google (US-02 y US-03):** el frontend usa `signInWithPopup` y llama a `GET /api/users/me`. Si responde 404 `PROFILE_NOT_FOUND`, lleva a la persona a `/registro/usuario` y envía el nombre elegido a `POST /api/users/me`.
- **Inicio y cierre de sesión (US-03):** los hace el SDK de Firebase en el frontend; la API solo verifica el token en cada petición privada.

### Unicidad del nombre de usuario

Cada nombre de usuario se reserva en la colección `usernames/{nombre en minúsculas}` dentro de la misma transacción que crea `users/{uid}`. Si dos personas piden el mismo nombre a la vez, solo una transacción lo consigue; la otra recibe 409 `USERNAME_TAKEN`. La comparación no distingue mayúsculas.

### Formato de errores

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Revisa los datos marcados e intenta de nuevo.",
  "errors": [{ "field": "password", "message": "Tu contraseña debe incluir al menos un número." }]
}
```

Códigos: `VALIDATION_ERROR` e `INVALID_JSON` (400), `AUTH_REQUIRED` e `INVALID_TOKEN` (401), `FORBIDDEN` (403), `PROFILE_NOT_FOUND` y `NOT_FOUND` (404), `USERNAME_TAKEN`, `EMAIL_TAKEN` y `PROFILE_EXISTS` (409), `INTERNAL_ERROR` (500).

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
- **`utils/`**: Error HTTP con código y mensaje en español (`HttpError`).

---

## 🧪 Pruebas locales con los emuladores de Firebase

Para probar sin tocar el proyecto real (requiere Java):

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-salon
```

En otra terminal, con un archivo de cuenta de servicio cualquiera cuyo `project_id` sea `demo-salon`:

```bash
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npm run dev
```
