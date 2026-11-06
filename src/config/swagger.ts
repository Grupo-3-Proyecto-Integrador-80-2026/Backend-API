// src/config/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Backend API - Proyecto Integrador",
      version: "1.0.0",
      description:
        "Documentación de los endpoints del Backend API del Proyecto Integrador.",
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
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Ingresa el Firebase ID Token del usuario.",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;