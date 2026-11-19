# Contrato Socket.IO · TS-02

Namespace `/`, path `/socket.io`, cliente Socket.IO 4.x. Conectar a la URL HTTPS del servicio **realtime**. El token viaja en `auth.token`, nunca en la URL. Si falta, `connect_error.message` vale `AUTH_REQUIRED`; si Firebase no lo verifica, `INVALID_TOKEN`. Al vencer el token, el servidor desconecta el socket: obtener un token nuevo, reconectar y volver a entrar en la sala.

```js
const socket = io(realtimeUrl, {
  auth: async callback => callback({ token: await user.getIdToken() })
});
// Tras "connect":
const joined = await socket.timeout(8000).emitWithAck("room:join", { roomId });
if (joined.ok) {
  const sent = await socket.timeout(8000).emitWithAck("message:send", { roomId, text: "Hola" });
  if (sent.ok) mostrarMensaje(sent.message);
}
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
| `message:new` | `{id,roomId,authorId,text,createdAt}` | Tras confirmar Firestore. `createdAt` es una fecha ISO 8601; `authorId` procede del token. |

**Comprobación en producción:** abrir sesiones A y B en una sala y C en otra. Enviar desde A: cotejar el ID del ACK con el evento de B y el documento `messages/{id}` en Firestore; C no debe recibirlo. Cerrar la sesión B y comprobar `presence:left` en A. Repetir la conexión sin token y el ingreso con un ID inexistente para comprobar los errores. Registrar la URL y los resultados reales en el DUE.
