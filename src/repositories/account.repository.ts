import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase";

// Marcador durable: permite reintentar después de un fallo de Auth o Firestore.
// TS-02 debe comprobarlo antes de crear salas o mensajes para este usuario.
export const markAccountDeletion = async (uid: string): Promise<void> => {
  await db.collection("accountDeletions").doc(uid).set({
    requestedAt: FieldValue.serverTimestamp()
  }, { merge: true });
};

export const isAccountDeleting = async (uid: string): Promise<boolean> =>
  (await db.collection("accountDeletions").doc(uid).get()).exists;

const deleteQuery = async (query: FirebaseFirestore.Query): Promise<void> => {
  // Lotes acotados; volver a consultar permite reintentar una eliminación parcial.
  while (true) {
    const page = await query.limit(100).get();
    if (page.empty) return;
    for (const doc of page.docs) await db.recursiveDelete(doc.ref);
  }
};

export const deleteAccountData = async (uid: string): Promise<void> => {
  const rooms = db.collection("rooms").where("ownerId", "==", uid);
  while (true) {
    const page = await rooms.limit(100).get();
    if (page.empty) break;
    for (const room of page.docs) {
      await deleteQuery(db.collection("messages").where("roomId", "==", room.id));
      await db.recursiveDelete(room.ref);
    }
  }
  await deleteQuery(db.collection("messages").where("authorId", "==", uid));

  // Buscar por propietario evita borrar la reserva de otra persona y también
  // libera reservas antiguas si el perfil ya no existe tras un intento parcial.
  await deleteQuery(db.collection("usernames").where("uid", "==", uid));
  await db.recursiveDelete(db.collection("users").doc(uid));
};

export const finishAccountDeletion = async (uid: string): Promise<void> => {
  await db.collection("accountDeletions").doc(uid).delete();
};
