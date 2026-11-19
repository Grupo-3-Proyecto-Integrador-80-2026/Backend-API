# Backend de tiempo real

Servicio Node.js/TypeScript independiente de la API REST. Usa Socket.IO 4 y el mismo proyecto Firebase que la API.

**Desarrollo:** desde esta carpeta, `npm ci`, `npm test`, `npm run build` y `npm start`. Para arrancar, exporta `GOOGLE_APPLICATION_CREDENTIALS` (ruta al JSON de Firebase Admin) y `FRONTEND_ORIGIN` (origen exacto, sin barra final). `PORT` vale 3001 por defecto. `GET /health` comprueba que el proceso HTTP está disponible.

**Sistema completo:** desde la raíz de Backend-API, configura `.env` según `.env.example`, coloca la clave en `credentials/serviceAccountKey.json` y ejecuta `docker compose up --build`. Se espera el repositorio frontend como directorio hermano, con el nombre indicado en el Compose. Frontend: `http://localhost:8080`; API: `http://localhost:3000`; Socket.IO: `http://localhost:3001`.

**Render:** quien administra el despliegue importa el Blueprint `render.yaml` del repositorio, configura `FRONTEND_ORIGIN` con el origen HTTPS de Vercel y añade un *Secret File* llamado `serviceAccountKey.json` con la credencial del proyecto. Redesplegar después de agregar el secreto. Render asigna `PORT` y termina TLS. Mantener una sola instancia: la presencia y el adaptador de salas residen en memoria.
