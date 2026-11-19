import { Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { HttpError } from "../utils/http-error";

const rooms = () => db.collection("rooms");

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

export async function changeRoom(id: string, uid: string, name?: string) {
  const ref = rooms().doc(id);
  await db.runTransaction(async tx => {
    const room = await tx.get(ref);
    if (!room.exists || room.get("ownerId") !== uid || (name && room.get("deleting"))) {
      throw new HttpError(404, "ROOM_NOT_FOUND", "No se encontró la sala entre tus salas.");
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
