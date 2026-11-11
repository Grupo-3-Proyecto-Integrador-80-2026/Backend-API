// src/config/swagger.ts
import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";

const errorExample = (code: string, message: string) => ({
  "application/json": {
    schema: { $ref: "#/components/schemas/Error" },
    example: { success: false, code, message }
  }
});

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API · Salón de Estudio Colaborativo",
      version: "1.1.0",
      description: [
        "API REST del Salón de Estudio Colaborativo (Proyecto Integrador I, Grupo 3).",
        "",
        "**Autenticación:** el frontend inicia sesión con Firebase Authentication (correo o Google) y envía el",
        "ID token en el encabezado `Authorization: Bearer <token>`. Las rutas privadas responden 401 sin un token válido.",
        "",
        "**Errores:** todas las respuestas de error tienen `success: false`, un `code` estable para el frontend y un",
        "`message` en español listo para mostrar. Los errores de validación incluyen `errors` con el campo y cómo corregirlo."
      ].join("\n")
    },
    servers: [
      {
        url: "/",
        description: "Servidor actual (Producción / Local)",
      },
      {
        url: "http://localhost:3000",
        description: "Servidor local de desarrollo",
      },
    ],
    tags: [
      { name: "Authentication", description: "Creación de cuentas y verificación de sesión (TS-01)" },
      { name: "Users", description: "Perfiles de usuario guardados en Firestore (TS-01)" },
      { name: "Firebase", description: "Base técnica: conexión con Firestore (TS-00)" },
      { name: "Health", description: "Estado del servidor" }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Ingresa el Firebase ID Token del usuario.",
        },
      },
      schemas: {
        UserProfile: {
          type: "object",
          properties: {
            id: { type: "string", description: "UID de Firebase Authentication", example: "Xb3kP9mQ2rT7vW1yZ4aC6dE8fG0h" },
            firstName: { type: "string", example: "Ana María" },
            lastName: { type: "string", example: "Gómez Ruiz" },
            username: { type: "string", example: "ana_23" },
            email: { type: "string", format: "email", example: "ana.gomez@correounivalle.edu.co" },
            avatarUrl: { type: "string", format: "uri", nullable: true, example: "https://api.dicebear.com/9.x/thumbs/svg?seed=ana" },
            provider: { type: "string", enum: ["password", "google.com"], example: "password" },
            role: { type: "string", enum: ["student", "teacher", "admin"], example: "student" },
            createdAt: { type: "string", format: "date-time", nullable: true },
            updatedAt: { type: "string", format: "date-time", nullable: true }
          }
        },
        UserResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            user: { $ref: "#/components/schemas/UserProfile" }
          }
        },
        RegisterRequest: {
          type: "object",
          required: ["firstName", "lastName", "username", "email", "password", "avatarUrl"],
          properties: {
            firstName: { type: "string", maxLength: 50, description: "Letras, espacios, guiones y apóstrofos.", example: "Ana María" },
            lastName: { type: "string", maxLength: 50, description: "Letras, espacios, guiones y apóstrofos.", example: "Gómez Ruiz" },
            username: { type: "string", minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_]+$", description: "Único sin distinguir mayúsculas.", example: "ana_23" },
            email: { type: "string", format: "email", example: "ana.gomez@correounivalle.edu.co" },
            password: { type: "string", format: "password", minLength: 8, maxLength: 128, description: "Al menos una letra y un número.", example: "Estudio2026" },
            avatarUrl: { type: "string", format: "uri", description: "Dirección https de la imagen del avatar.", example: "https://api.dicebear.com/9.x/thumbs/svg?seed=ana" }
          }
        },
        CompleteProfileRequest: {
          type: "object",
          required: ["username"],
          properties: {
            username: { type: "string", minLength: 3, maxLength: 20, pattern: "^[A-Za-z0-9_]+$", example: "ana_23" },
            firstName: { type: "string", maxLength: 50, description: "Opcional; por defecto, el nombre de Google.", example: "Ana María" },
            lastName: { type: "string", maxLength: 50, description: "Opcional; por defecto, el apellido de Google.", example: "Gómez Ruiz" },
            avatarUrl: { type: "string", format: "uri", description: "Opcional; por defecto, la foto de Google." }
          }
        },
        UsernameAvailability: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            username: { type: "string", example: "ana_23" },
            available: { type: "boolean", example: false }
          }
        },
        FieldError: {
          type: "object",
          properties: {
            field: { type: "string", example: "password" },
            message: { type: "string", example: "Tu contraseña debe tener al menos 8 caracteres." }
          }
        },
        Error: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            code: { type: "string", example: "VALIDATION_ERROR" },
            message: { type: "string", example: "Revisa los datos marcados e intenta de nuevo." },
            errors: { type: "array", items: { $ref: "#/components/schemas/FieldError" } }
          }
        }
      },
      responses: {
        ValidationError: {
          description: "Datos inválidos (`VALIDATION_ERROR`) o JSON mal formado (`INVALID_JSON`). Cada error indica el campo y cómo corregirlo.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: {
                success: false,
                code: "VALIDATION_ERROR",
                message: "Revisa los datos marcados e intenta de nuevo.",
                errors: [
                  { field: "email", message: "Escribe un correo válido, por ejemplo nombre@correo.com." },
                  { field: "password", message: "Tu contraseña debe incluir al menos un número." }
                ]
              }
            }
          }
        },
        Unauthorized: {
          description: "Sin token (`AUTH_REQUIRED`) o con un token inválido o expirado (`INVALID_TOKEN`).",
          content: errorExample("AUTH_REQUIRED", "Debes iniciar sesión para continuar.")
        },
        InternalError: {
          description: "Error inesperado del servidor.",
          content: errorExample("INTERNAL_ERROR", "Ocurrió un error inesperado. Intenta de nuevo en unos minutos.")
        }
      }
    },
  },
  // Ruta relativa a este archivo: en desarrollo lee src/routes/*.ts y en producción (Docker) dist/routes/*.js
  apis: [path.join(__dirname, "../routes/*.{ts,js}")],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
