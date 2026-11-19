# Colecciones de TS-02

- `rooms/{id}`: ID automático Firestore que el anfitrión comparte como invitación. `name` (1–80 caracteres tras recortar espacios), `ownerId` (UID autenticado), `createdAt` (Timestamp). Durante el borrado, `deleting: true` oculta la sala y bloquea nuevas escrituras.
- `messages/{id}`: ID automático, `roomId` (ID de sala), `authorId` (UID del socket), `text` (1–2000 caracteres tras recortar espacios) y `createdAt` (Timestamp asignado por el servidor). La presencia es efímera y no se guarda.

Las consultas de salas propias y de limpieza de mensajes usan los índices automáticos de campo único. El cliente no accede a Firestore: crea y administra salas mediante REST y envía texto mediante Socket.IO.
