import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { HttpError } from "../utils/http-error";

const rooms = () => db.collection("rooms");

export async function invitedRoom(id: string, uid: string) {
  const room = await rooms().doc(id).get();
  if (!room.exists || room.get("deleting")) {
    throw new HttpError(404, "ROOM_NOT_FOUND", "No se encontró la sala. Revisa el ID.");
  }
  const ownerId = room.get("ownerId");
  const [user, marker, ownerMarker] = await db.getAll(db.collection("users").doc(uid),
    db.collection("accountDeletions").doc(uid), db.collection("accountDeletions").doc(ownerId));
  if (!user.exists || marker.exists) throw new HttpError(403, "ACCOUNT_INACTIVE", "Se requiere un perfil activo.");
  if (ownerMarker.exists) throw new HttpError(404, "ROOM_NOT_FOUND", "La sala ya no está disponible.");
  return { id, ownerId, name: room.get("name"), createdAt: room.get("createdAt").toDate().toISOString() };
}

export async function createRoom(ownerId: string, name: string) {
  const ref = rooms().doc();
  const createdAt = Timestamp.now();
  await db.runTransaction(async tx => {
    const marker = db.collection("accountDeletions").doc(ownerId);
    if ((await tx.get(marker)).exists) {
      throw new HttpError(409, "ACCOUNT_DELETION_PENDING", "La cuenta se está eliminando.");
    }
    tx.create(ref, { ownerId, name, createdAt });
  });
  return { id: ref.id, ownerId, name, createdAt: createdAt.toDate().toISOString() };
}

export async function ownRooms(uid: string) {
  const snapshot = await rooms().where("ownerId", "==", uid).get();
  return snapshot.docs.filter(doc => !doc.get("deleting")).map(doc => ({
    id: doc.id, ownerId: uid, name: doc.get("name"),
    createdAt: doc.get("createdAt").toDate().toISOString()
  }));
}

export async function roomHistory(id: string, uid: string, limit: number, before?: string) {
  await invitedRoom(id, uid);
  const messages = db.collection("messages");
  let query = messages.where("roomId", "==", id).orderBy("createdAt", "desc");
  if (before) {
    const cursor = await messages.doc(before).get();
    if (!cursor.exists || cursor.get("roomId") !== id) {
      throw new HttpError(400, "INVALID_CURSOR", "Vuelve a cargar el historial.");
    }
    // El snapshot incluye el ID como desempate cuando coinciden las fechas.
    query = query.startAfter(cursor);
  }
  const page = await query.limit(limit + 1).get();
  const items = page.docs.slice(0, limit).reverse().map(doc => ({
    id: doc.id, roomId: id, authorId: doc.get("authorId"), authorName: doc.get("authorName") ?? "Estudiante",
    text: doc.get("text"), createdAt: doc.get("createdAt").toDate().toISOString()
  }));
  return { messages: items, nextBefore: page.size > limit ? items[0].id : null };
}

export async function changeRoom(id: string, uid: string, name?: string) {
  const ref = rooms().doc(id);
  await db.runTransaction(async tx => {
    const room = await tx.get(ref);
    if (!room.exists || (name && room.get("deleting"))) {
      throw new HttpError(404, "ROOM_NOT_FOUND", "No se encontró la sala entre tus salas.");
    }
    if (room.get("ownerId") !== uid) {
      throw new HttpError(403, "HOST_REQUIRED", "Solo el anfitrión puede modificar la sala.");
    }
    tx.update(ref, name ? { name } : { deleting: true });
  });
  if (name) return;

  // El marcador bloquea nuevos mensajes y permite reintentar una limpieza parcial.
  const messages = db.collection("messages").where("roomId", "==", id);
  for (;;) {
    const page = await messages.limit(200).get();
    if (page.empty) break;
    const batch = db.batch();
    for (const doc of page.docs) batch.delete(doc.ref);
    await batch.commit();
  }
  await ref.delete();
}
