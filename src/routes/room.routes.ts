import { Router } from "express";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { changeRoom, createRoom, ownRooms } from "../repositories/room.repository";
import { HttpError } from "../utils/http-error";

const router = Router();
router.use(verifyFirebaseToken);

function roomName(body: unknown): string {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 80) {
    throw new HttpError(400, "INVALID_ROOM_NAME", "Escribe un nombre de sala de 1 a 80 caracteres.");
  }
  return name.trim();
}

router.param("id", (_req, _res, next, id) => {
  if (!/^[A-Za-z0-9]{20}$/.test(id)) {
    return next(new HttpError(400, "INVALID_ROOM_ID", "El ID de sala no es válido."));
  }
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
 *       '400': { description: INVALID_ROOM_NAME o INVALID_JSON }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '409': { description: ACCOUNT_DELETION_PENDING }
 * /api/rooms/{id}:
 *   parameters:
 *     - in: path
 *       name: id
 *       required: true
 *       schema: { type: string, pattern: '^[A-Za-z0-9]{20}$' }
 *   patch:
 *     tags: [Salas]
 *     summary: Renombrar una sala propia
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { $ref: '#/components/requestBodies/RoomName' }
 *     responses:
 *       '204': { description: Sala actualizada sin cuerpo de respuesta }
 *       '400': { description: Nombre o ID inválido }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { description: Sala inexistente o ajena }
 *   delete:
 *     tags: [Salas]
 *     summary: Eliminar una sala propia con todos sus mensajes
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '204': { description: Sala eliminada sin cuerpo de respuesta }
 *       '400': { description: ID inválido }
 *       '401': { $ref: '#/components/responses/Unauthorized' }
 *       '404': { description: Sala inexistente o ajena }
 */
router.post("/", async (req, res) => {
  const room = await createRoom(res.locals.firebaseUser.uid, roomName(req.body));
  res.status(201).json({ success: true, room });
});
router.get("/", async (_req, res) => {
  res.json({ success: true, rooms: await ownRooms(res.locals.firebaseUser.uid) });
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
