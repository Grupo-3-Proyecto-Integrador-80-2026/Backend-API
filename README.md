
# Backend API - Proyecto Integrador

Backend desarrollado con Node.js, TypeScript y Express para el Proyecto Integrador del Grupo 3.

## Tecnologías

- Node.js
- TypeScript
- Express 5
- Firebase Authentication
- Firebase Admin SDK
- Cloud Firestore
- Zod
- Swagger / OpenAPI

## Requisitos

- Node.js y npm.
- Git.
- Acceso al proyecto Firebase.
- Credenciales de Firebase Admin SDK.

## Instalación

Clonar el repositorio:

```bash
git clone https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Backend-API.git
```

Ingresar a la carpeta:

```bash
cd Backend-API
```

Instalar dependencias:

```bash
npm install
```

## Variables de entorno

Crear un archivo `.env` en la raíz del proyecto, tomando como referencia `.env.example`.

```env
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=./credentials/serviceAccountKey.json
```

### Configuración de Firebase

1. Obtener las credenciales de Firebase Admin SDK mediante el administrador del proyecto.
2. Crear una carpeta `credentials` en la raíz del backend.
3. Guardar el archivo JSON de credenciales dentro de esa carpeta con el nombre `serviceAccountKey.json`.
4. Configurar la ruta en `GOOGLE_APPLICATION_CREDENTIALS`.

**Importante:** Nunca subir el archivo JSON de credenciales ni el `.env` a GitHub.

Cada desarrollador debe utilizar sus propias credenciales autorizadas.

## Ejecutar el proyecto

Modo desarrollo:

```bash
npm run dev
```

Compilar TypeScript:

```bash
npm run build
```

Ejecutar versión compilada:

```bash
npm start
```

El servidor utiliza el puerto 3000 por defecto.

## Endpoints principales

| Método | Endpoint | Descripción | Acceso |
|---|---|---|---|
| GET | `/api/health` | Estado del servidor | Público |
| GET | `/api/test/firebase` | Verificar conexión Firebase | Público |
| GET | `/api/protected` | Consultar datos protegidos | Autenticado |
| GET | `/api/users/me` | Consultar perfil propio | Autenticado |
| GET | `/api/users` | Consultar todos los usuarios | Administrador |

## Autenticación

La API utiliza Firebase Authentication.

Los endpoints protegidos requieren un Firebase ID Token mediante el encabezado:

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

## Documentación Swagger

Con el servidor ejecutándose, acceder a:

http://localhost:3000/api-docs

Desde Swagger UI se pueden consultar y probar los endpoints documentados.

## Arquitectura

El backend está organizado por capas:

- `config`: configuración de Firebase y Swagger.
- `controllers`: manejo de solicitudes HTTP.
- `middlewares`: autenticación, autorización, validación y errores.
- `repositories`: acceso a Firestore.
- `routes`: definición de endpoints.
- `services`: lógica de negocio.
- `validators`: esquemas de validación.

## Proyecto

Proyecto Integrador - Grupo 3.
