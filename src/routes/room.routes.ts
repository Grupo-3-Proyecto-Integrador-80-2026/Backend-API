import { Router } from "express";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { changeRoom, createRoom, invitedRoom, ownRooms } from "../repositories/room.repository";
import { HttpError } from "../utils/http-error";

const router = Router();
router.use(verifyFirebaseToken);

function roomName(body: unknown): string {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
    const message = "Escribe un nombre de sala de 1 a 80 caracteres.";
    throw new HttpError(400, "INVALID_ROOM_NAME", message, [{ field: "name", message }]);
  }
  return name.trim();
}

router.param("id", (req, _res, next, id) => {
  const normalized: string = id.trim();
  if (!/^[A-Za-z0-9]{20}$/.test(normalized)) {
    return next(new HttpError(400, "INVALID_ROOM_ID", "El ID de sala no es válido."));
  }
  req.params.id = normalized;
  next();
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       required: [id, ownerId, name, createdAt]
 *       properties:
 *         id: { type: string, pattern: '^[A-Za-z0-9]{20}$' }
 *         ownerId: { type: string }
 *         name: { type: string }
 *         createdAt: { type: string, format: date-time }
 *   requestBodies:
 *     RoomName:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 80, example: Álgebra }
 * /api/rooms:
 *   get:
 *     tags: [Salas]
 *     summary: Listar solo las salas del usuario autenticado
 *     description: El dashboard recibe rooms vacío si el usuario aún no ha creado salas. Cada elemento contiene el ID de invitación que se puede copiar.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Lista propia, posiblemente vacía
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 rooms: { type: array, items: { $ref: '#/components/schemas/Room' } }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Salas]
 *     summary: Crear una sala con ID de invitación único
 *     description: El servidor recorta los espacios externos del nombre, genera room.id y asigna room.ownerId desde el token. El frontend puede abrir la sala con ese ID como anfitrión.
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { $ref: '#/components/requestBodies/RoomName' }
 *     responses:
 *       '201':
 *         description: Sala creada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 room: { $ref: '#/components/schemas/Room' }
 *       '400':
 *         description: INVALID_ROOM_NAME si el nombre recortado está vacío o supera 80 caracteres. INVALID_JSON si el cuerpo no se puede leer.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *             example:
 *               success: false
 *               code: INVALID_ROOM_NAME
 *               message: Escribe un nombre de sala de 1 a 80 caracteres.
 *               errors: [{ field: name, message: Escribe un nombre de sala de 1 a 80 caracteres. }]
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '409': { description: ACCOUNT_DELETION_PENDING }
 * /api/rooms/{id}:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema: { type: string, pattern: '^[A-Za-z0-9]{20}$' }
 *   get:
 *     tags: [Salas]
 *     summary: Validar el ID de invitación y obtener los datos de la sala
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Comparar ownerId con el UID actual para mostrar controles.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 room: { $ref: '#/components/schemas/Room' }
 *       '400': { description: INVALID_ROOM_ID }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { description: ACCOUNT_INACTIVE }
 *       '404': { description: ROOM_NOT_FOUND }
 *   patch:
 *     tags: [Salas]
 *     summary: Renombrar una sala propia
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { $ref: '#/components/requestBodies/RoomName' }
 *     responses:
 *       '204': { description: Sala actualizada sin cuerpo de respuesta }
 *       '400': { description: Nombre o ID inválido }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { description: HOST_REQUIRED }
 *       '404': { description: ROOM_NOT_FOUND }
 *   delete:
 *     tags: [Salas]
 *     summary: Eliminar una sala propia con todos sus mensajes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '204': { description: Sala eliminada sin cuerpo de respuesta }
 *       '400': { description: ID inválido }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '403': { description: HOST_REQUIRED }
 *       '404': { description: ROOM_NOT_FOUND }
 */
router.post("/", async (req, res) => {
  const room = await createRoom(res.locals.firebaseUser.uid, roomName(req.body));
  res.status(201).json({ success: true, room });
});
router.get("/", async (_req, res) => {
  res.json({ success: true, rooms: await ownRooms(res.locals.firebaseUser.uid) });
});
router.get("/:id", async (req, res) => {
  res.json({ success: true, room: await invitedRoom(req.params.id, res.locals.firebaseUser.uid) });
});
router.patch("/:id", async (req, res) => {
  await changeRoom(req.params.id, res.locals.firebaseUser.uid, roomName(req.body));
  res.status(204).end();
});
router.delete("/:id", async (req, res) => {
  await changeRoom(req.params.id, res.locals.firebaseUser.uid);
  res.status(204).end();
});

export default router;
