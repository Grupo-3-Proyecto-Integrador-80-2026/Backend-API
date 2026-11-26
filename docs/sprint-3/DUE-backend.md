# DUE · Sprint 3 · BE Lead

## S3-C06 · Salas, permisos e historial

[Swagger en Render](https://backend-api-grupo3.onrender.com/api-docs/) · [Contrato para Juan Pablo](../eventos-socket.md).

| Evidencia de producción | Qué debe verse en el enlace | Estado |
|---|---|---|
| US-07 | En una sala de prueba, PATCH y DELETE con cuenta invitada → 403 `HOST_REQUIRED`; el anfitrión sigue viendo el nombre original. Al borrar como anfitrión, el invitado recibe aviso y vuelve al panel. | Pendiente |
| US-08 | Abrir por enlace o pegar el ID con espacios; comparar con un ID inexistente. | Pendiente |
| US-10 | Dos sesiones en A, otra en B. Enviar en A; cotejar ID, autor, texto y hora con `messages/{id}` en Firestore. B no recibe el mensaje. | Pendiente |
| Reconexión | Desconectar la red del invitado, enviar desde el anfitrión, restablecer la red: aparece una sola presencia, se recupera el mensaje anterior y llega el siguiente en vivo. | Pendiente |
| US-11 | Con tres mensajes, pedir `limit=2`; consultar `before=nextBefore` y comprobar que aparece el primero sin repetir los otros dos. | Pendiente |

## S3-C07 · Despliegue

[Frontend Vercel](https://miniproyecto-2-inky.vercel.app) · [API Render](https://backend-api-grupo3.onrender.com/api/health) · [Realtime Render](https://salon-backend-realtime-indl.onrender.com/health).
Los tres destinos y Swagger respondieron HTTP 200 antes de integrar estos PR. Esta comprobación solo acredita disponibilidad.

[Dockerfile API](../../Dockerfile) · [Dockerfile realtime](../../backend-realtime/Dockerfile) · [Dockerfile frontend](https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Frontend-Collaborative-study-room-platform/blob/main/frontend/Dockerfile) · [Compose](../../docker-compose.yml).

PR encadenados: [US-07 #21](https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Backend-API/pull/21), [US-08 #22](https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Backend-API/pull/22), [US-10 #23](https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Backend-API/pull/23), [US-11 #24](https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Backend-API/pull/24). Desarrollo y documentación con asistencia de IA.

### Cierre con quien administra las cuentas

Pruebas técnicas previas al despliegue: 80 pruebas de API aprobadas, incluida paginación con marcas de tiempo idénticas en el emulador de Firestore. La prueba de Socket.IO con clientes reales verificó aislamiento, presencia, aviso de cierre y reconexión tras cortar el transporte. `docker compose config --quiet` y la construcción de los tres servicios pasaron. [PR Docker del frontend](https://github.com/Grupo-3-Proyecto-Integrador-80-2026/Frontend-Collaborative-study-room-platform/pull/22).

1. Revisar los PR en ese orden y orientar cada uno a `main` cuando su dependencia ya esté integrada. Desplegar reglas e índice al proyecto correcto (`firebase deploy --only firestore:rules,firestore:indexes --project <proyecto>`); comprobar que el índice de `messages` esté listo.
2. En los dos servicios Render **existentes**, desplegar el commit integrado desde GitHub usando Docker. La API usa contexto `.` y realtime `backend-realtime/`. Montar en cada servicio la cuenta de servicio como archivo secreto y apuntar `GOOGLE_APPLICATION_CREDENTIALS` a ese archivo. En realtime fijar `FRONTEND_ORIGIN` al origen exacto de Vercel.
3. Juan Pablo integra el contrato, configura `VITE_API_URL` y `VITE_REALTIME_URL` con las respectivas URL HTTPS en Vercel y publica el frontend. Verificar que Swagger muestre versión **1.3.0** y el historial. Registrar SHA y fecha de los tres despliegues.
4. Ejecutar los escenarios anteriores en producción y enlazar las capturas en esta tabla o en el DUE compartido. Adjuntar consola de navegador y logs de ambos servicios durante el flujo exitoso; para el 403 capturar solo estado y respuesta, nunca encabezados de autenticación. Mantener la URL visible.

**Pendientes de evidencia S3-C07:** SHA publicados, capturas de consola/logs, revisión conjunta y enlaces a las capturas accesibles al docente.
