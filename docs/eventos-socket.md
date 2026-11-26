# Contrato Socket.IO · Sprint 3 (Juan Pablo)

Namespace `/`, path `/socket.io`, cliente Socket.IO 4.x. Conectar a la URL HTTPS del servicio **realtime**. El token viaja en `auth.token`, nunca en la URL. Si falta, `connect_error.message` vale `AUTH_REQUIRED`; si Firebase no lo verifica, `INVALID_TOKEN`. Al vencer el token, el servidor desconecta el socket: obtener un token nuevo, reconectar y volver a entrar en la sala.

```js
const socket = io(import.meta.env.VITE_REALTIME_URL, {
  auth: async callback => callback({ token: await user.getIdToken() })
});
// Conservar el ID en la ruta mientras el usuario permanezca en la sala.
// Registrar los listeners una sola vez; retirarlos al desmontar la pantalla.
socket.on("connect", async () => {
  try {
    const ack = await socket.timeout(8000).emitWithAck("room:join", { roomId });
    if (!ack.ok) return ack.code === "ROOM_NOT_FOUND" ? volverAlPanel() : mostrarError(ack.code);
    actualizarParticipantes(ack.members);
    await sincronizarHistorial(roomId); // GET /api/rooms/:id/messages; unir por id
  } catch { mostrarError("No se pudo sincronizar. Reintenta."); }
});
socket.on("room:deleted", ({roomId: id}) => {
  if (id === roomId) { avisar("El anfitrión eliminó la sala."); volverAlPanel(); }
});
socket.on("disconnect", reason => {
  if (reason === "io server disconnect" && user) socket.connect(); // auth pide token vigente
});
```

| Cliente → servidor | Payload | ACK de éxito |
|---|---|---|
| `room:join` | `{roomId}` | `{ok:true, roomId, members:[uid,…]}`. El ID compartido da acceso. Cambiar de sala abandona la anterior; un ID inválido o inexistente conserva la membresía actual. |
| `room:leave` | `{roomId}` | `{ok:true}`. Solo para la sala actual. |
| `message:send` | `{roomId,text}` | `{ok:true,message}`. Se persiste antes de confirmar y difundir. El autor lo toma del ACK. |

Los tres eventos requieren callback de ACK (`emitWithAck` lo proporciona). En error: `{ok:false,code}`. `INVALID_ROOM_ID`: no son 20 caracteres alfanuméricos; `ROOM_NOT_FOUND`: sala inexistente o en eliminación; `ACCOUNT_INACTIVE`: cuenta sin perfil o en eliminación; `NOT_IN_ROOM`: primero hay que entrar en esa sala; `INVALID_TEXT`: entre 1 y 2000 caracteres tras recortar espacios; `DISCONNECTED`: la conexión terminó durante el ingreso; `INTERNAL_ERROR`: fallo del servidor. Un timeout del cliente no confirma si se guardó el mensaje; el reenvío no es idempotente.

| Servidor → otros sockets de la sala | Payload | Momento |
|---|---|---|
| `presence:joined` | `{roomId,uid}` | Primera conexión de esa persona en la sala. |
| `presence:left` | `{roomId,uid}` | Al salir, cambiar de sala o desconectar la última pestaña de esa persona. |
| `message:new` | `{id,roomId,authorId,authorName,text,createdAt}` | Tras confirmar Firestore, a los demás sockets de la misma sala. El emisor recibe el mismo objeto en su ACK. `createdAt` es ISO 8601; `authorId` procede del token y `authorName` del perfil. |
| `room:updated` | `{roomId,name}` | A cada socket de esa sala al iniciar la escucha y cuando cambia el nombre. |
| `room:deleted` | `{roomId}` | A todos los conectados a esa sala, incluido el anfitrión, al marcarse en eliminación o desaparecer. El servidor los saca de la sala. |

**REST para integrar.** Enviar `Authorization: Bearer <ID token>` a la API. `GET /api/rooms/:id` devuelve `{success,room}`; comparar `room.ownerId` con el UID actual. `PATCH /api/rooms/:id` recibe `{name}` y `DELETE /api/rooms/:id` no necesita cuerpo: ambos devuelven `204` sin JSON. Un invitado recibe `403 HOST_REQUIRED`; un ID mal formado `400 INVALID_ROOM_ID`, una sala inexistente `404 ROOM_NOT_FOUND`, y sin sesión `401`. Recortar el ID antes de construir la URL; en el formulario vacío, pedir el ID sin consultar el listado.

**Historial.** `GET /api/rooms/:id/messages?limit=50` devuelve `{success,messages,nextBefore}`. Cada página ya viene de antigua a reciente. Anteponer las páginas anteriores (`?limit=50&before=<nextBefore>`) hasta recibir `null`; una sala vacía devuelve `[]`. Tras recuperar la red, cargar páginas hasta alcanzar el último ID conocido y combinar con los eventos recibidos durante la carga, sin duplicar por ID. `400 INVALID_CURSOR` pide reiniciar la consulta. Los errores de validación del límite devuelven `400 INVALID_LIMIT`.

**Comprobación en producción:** abrir sesiones A y B en una sala y C en otra. Enviar desde A: cotejar el ID del ACK con el evento de B y el documento `messages/{id}` en Firestore; C no debe recibirlo. Cerrar la sesión B y comprobar `presence:left` en A. Repetir la conexión sin token y el ingreso con un ID inexistente para comprobar los errores. Registrar la URL y los resultados reales en el DUE.
