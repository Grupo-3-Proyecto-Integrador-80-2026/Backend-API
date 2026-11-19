# US-05 — Eliminar cuenta propia

## Trazabilidad

- PI-310 / S2-C06: endpoint autenticado, eliminación de Firestore y Firebase Auth, liberación del username y pruebas automatizadas.
- PI-311 / S2-C07: documentación del endpoint, política de datos y contrato para frontend.
- Rama independiente desde `main`: `feature/US-05-eliminar-cuenta`. US-04 va en otra rama y ambas deben integrarse antes de desplegar el sprint completo.
- Uso de IA: implementación y pruebas asistidas por IA; el responsable debe revisar y poder explicar los cambios.

## Contrato HTTP

```http
DELETE /api/users/me
Authorization: Bearer <Firebase ID token>
```

No recibe cuerpo ni identificador del usuario. El UID se obtiene exclusivamente del token verificado. La API comprueba también su revocación y el estado de la cuenta.

| Estado | Significado | Acción del frontend |
|---|---|---|
| 204 | Cuenta eliminada; cuerpo vacío | `signOut(auth)`, limpiar estado local y navegar al Login con confirmación |
| 401 | `AUTH_REQUIRED` o `INVALID_TOKEN` | Solicitar inicio de sesión |
| 500 | `INTERNAL_ERROR` | Mostrar error y ofrecer reintentar; no cerrar la sesión automáticamente |

El frontend debe mostrar antes un modal que explique: **«Esta acción no se puede deshacer. Se eliminarán tu cuenta, tus salas y tus mensajes. Los mensajes de otros participantes en tus salas también se eliminarán.»**

«Cancelar» o Esc cierran el modal sin llamar al endpoint. El retorno de foco, el anuncio accesible y la navegación corresponden a PI-312.

Ejemplo para QA con una cuenta desechable:

```bash
curl -i -X DELETE "$API_URL/api/users/me" \
  -H "Authorization: Bearer $ID_TOKEN"
```

No enviar esta petición sobre una cuenta que se quiera conservar.

## Política de datos asociados

Política implementada, pendiente de validación del equipo UX/Coordinación:

| Datos | Acción |
|---|---|
| `rooms` donde `ownerId == uid` | Eliminar definitivamente; no transferir propiedad |
| `messages` donde `roomId == sala eliminada` | Eliminar todos, incluidos los de otros participantes |
| `messages` donde `authorId == uid` en otras salas | Eliminar definitivamente |
| Subcolecciones de los documentos eliminados | Eliminar mediante `recursiveDelete` |
| `usernames` donde `uid == uid autenticado` | Eliminar reservas, permitiendo reutilizar el nombre |
| `users/{uid}` y subcolecciones | Eliminar |
| Cuenta de Firebase Authentication | Eliminar al terminar la limpieza en Firestore |

### Contrato para TS-02

En el repositorio actual aún no existen endpoints ni modelos de salas/mensajes. La limpieza usa **colecciones raíz** `rooms` y `messages`, con campos obligatorios `rooms.ownerId`, `messages.roomId` y `messages.authorId`.

TS-02 deberá respetar esos nombres o adaptar este repositorio y sus pruebas. Antes de escribir datos relacionados, deberá comprobar `accountDeletions/{uid}` y rechazar escrituras para usuarios en eliminación; además, verificar que la sala exista y que su propietario no esté en eliminación. Para evitar carreras, esas comprobaciones deben formar parte de las transacciones de creación de salas/mensajes. No crear mensajes nuevos mientras se elimina una sala.

No hay actualmente membresías, adjuntos ni Firebase Storage en el modelo; si se introducen, deberán añadirse a esta política y a la limpieza.

## Fallos y reintentos

Firebase Auth y Firestore no comparten transacciones. La eliminación es **por etapas e irreversible**, no una operación atómica:

1. Crear `accountDeletions/{uid}` con `requestedAt`.
2. Eliminar datos asociados en páginas de hasta 100 documentos.
3. Eliminar reservas de username y perfil.
4. Eliminar la cuenta Auth.
5. Retirar el marcador.

Si falla una etapa, el error llega al manejador global. Auth se mantiene mientras no se complete la limpieza, permitiendo reintentar DELETE con la misma sesión. El reintento tolera documentos ausentes y recorre los datos restantes. POST/PATCH de perfil se bloquean con **409 `ACCOUNT_DELETION_PENDING`**; no se puede cancelar una eliminación ya iniciada ni garantizar que los datos permanezcan intactos tras un error.

Si Auth ya no existe al ejecutar su borrado, el servicio lo considera completado. Una petición posterior con el token de esa cuenta recibe 401. Si solo falla retirar el marcador final, la API devuelve 204 y registra el fallo; un administrador puede comprobar que Auth y los datos ya no existen y borrar el marcador residual. El marcador contiene el UID como ID y una fecha, no una copia del perfil.

Si el usuario abandona un proceso parcial, el administrador debe completar la limpieza con Admin SDK; actualmente no hay un worker automático. Las peticiones de edición ya iniciadas antes del marcador constituyen un caso de concurrencia a endurecer junto con el ciclo de vida transaccional de TS-02.

## Verificación

```bash
npm test
npm run test:typecheck
npm run build
```

Pruebas locales con Firebase simulado:
- DELETE autenticado devuelve 204 y usa el UID del token.
- Sin token o cuenta eliminada: 401 y ninguna eliminación.
- Firestore se limpia antes de borrar Auth.
- Fallos de Firestore/Auth permiten reintentar.
- Escritura de perfil bloqueada durante una eliminación pendiente.
- Eliminación de mensajes de salas propias y mensajes propios en otras salas.
- Liberación de reservas y limpieza de perfil sin borrar reservas de otros usuarios.

### Evidencia pendiente en producción

Ejecutar con dos cuentas desechables y, cuando TS-02 esté integrado, salas/mensajes:

1. Cancelar el modal: perfil, Auth y datos siguen existiendo.
2. Confirmar: 204, datos eliminados, cierre de sesión y Login.
3. Reutilizar el username liberado en otra cuenta.
4. Intentar usar el token anterior: 401.
5. Verificar eliminación de salas propias y sus mensajes; conservar salas ajenas y mensajes de otros autores en ellas.
6. Registrar evidencia con URL pública visible y enlace al PR en el DUE.

Los tests locales no acreditan estas comprobaciones en producción.
