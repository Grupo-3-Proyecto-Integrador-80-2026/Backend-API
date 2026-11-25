import { afterAll, describe, expect, it, vi } from "vitest";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Solo se ejecuta contra el emulador de loopback, nunca contra una cuenta real.
const local = /^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "");
vi.mock("../src/config/firebase", () => ({
  db: getFirestore(initializeApp({ projectId: "demo-salon" }, "historial-test"))
}));

describe.skipIf(!local)("Sprint 3 con Firestore emulado", () => {
  afterAll(async () => { await (await import("../src/config/firebase.js")).db.terminate(); });
  it("recupera páginas sin saltos con fechas iguales; conserva permisos y elimina el historial", async () => {
    const { db } = await import("../src/config/firebase.js");
    const { changeRoom, createRoom, roomHistory } = await import("../src/repositories/room.repository.js");
    const { id } = await createRoom("host", "Sala de prueba");
    const guest = "guest";
    await db.collection("users").doc(guest).set({ username: "Invitado" });
    expect(await roomHistory(id, guest, 2)).toEqual({ messages: [], nextBefore: null });
    const docs = Array.from({length: 4}, () => db.collection("messages").doc());
    const time = Timestamp.now();
    await Promise.all(docs.map((doc, i) => doc.set({
      roomId: i === 3 ? "otra" : id, authorId: "host", authorName: "Ana", text: `${i}`, createdAt: time
    })));
    const page = await roomHistory(id, guest, 2);
    expect(page.messages).toHaveLength(2);
    const older = await roomHistory(id, guest, 2, page.nextBefore!);
    expect(older.nextBefore).toBeNull();
    expect([...older.messages, ...page.messages].map(m => m.id)).toEqual(docs.slice(0, 3).map(d => d.id).sort());
    await expect(roomHistory(id, guest, 2, docs[3].id)).rejects.toMatchObject({code:"INVALID_CURSOR"});
    await expect(changeRoom(id, guest)).rejects.toMatchObject({code:"HOST_REQUIRED"});
    await changeRoom(id, "host", "Nuevo nombre");
    expect((await db.collection("rooms").doc(id).get()).get("name")).toBe("Nuevo nombre");
    await changeRoom(id, "host");
    await expect(roomHistory(id, guest, 2)).rejects.toMatchObject({code:"ROOM_NOT_FOUND"});
    expect((await db.collection("messages").where("roomId","==",id).get()).empty).toBe(true);
    expect((await docs[3].get()).exists).toBe(true);
    await docs[3].delete();
  }, 30000);
});
