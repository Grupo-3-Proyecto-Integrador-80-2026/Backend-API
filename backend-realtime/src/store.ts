import { Firestore, Timestamp, Transaction } from "firebase-admin/firestore";
import { EventError, RoomStore } from "./events";

export function firestoreRooms(db: Firestore): RoomStore {
  async function check(tx: Transaction, roomId: string, uid: string) {
    const [room, user, marker] = await tx.getAll(db.collection("rooms").doc(roomId),
      db.collection("users").doc(uid), db.collection("accountDeletions").doc(uid));
    if (!user.exists || marker.exists) throw new EventError("ACCOUNT_INACTIVE");
    if (!room.exists || room.get("deleting")) throw new EventError("ROOM_NOT_FOUND");
    const owner = room.get("ownerId");
    if (owner !== uid && (await tx.get(db.collection("accountDeletions").doc(owner))).exists) {
      throw new EventError("ROOM_NOT_FOUND");
    }
  }
  return {
    check: (roomId, uid) => db.runTransaction(tx => check(tx, roomId, uid)),
    append: (roomId, authorId, text) => db.runTransaction(async tx => {
      await check(tx, roomId, authorId);
      const ref = db.collection("messages").doc();
      const createdAt = Timestamp.now();
      tx.create(ref, { roomId, authorId, text, createdAt });
      return { id: ref.id, roomId, authorId, text, createdAt: createdAt.toDate().toISOString() };
    })
  };
}
