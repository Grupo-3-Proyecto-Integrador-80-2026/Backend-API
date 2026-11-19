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
