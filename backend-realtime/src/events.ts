import { Server, Socket } from "socket.io";

export class EventError extends Error {}
export interface Message {
  id: string; roomId: string; authorId: string; authorName: string; text: string; createdAt: string;
}
export interface RoomStore {
  watch(roomId: string, changed: (name: string | null) => void, failed: () => void): () => void;
  check(roomId: string, uid: string): Promise<void>;
  append(roomId: string, uid: string, text: string): Promise<Message>;
}

function readId(payload: any): string {
  if (typeof payload?.roomId !== "string" || !/^[A-Za-z0-9]{20}$/.test(payload.roomId.trim())) {
    throw new EventError("INVALID_ROOM_ID");
  }
  return payload.roomId.trim();
}

export function registerRoomEvents(io: Server, store: RoomStore) {
  // Adaptador de una instancia: agrupar sockets por UID evita anunciar dos veces
  // al estudiante que abre la misma sala en varias pestañas.
  function members(channel: string) {
    return new Set(Array.from(io.sockets.adapter.rooms.get(channel) ?? [],
      id => io.sockets.sockets.get(id)!.data.uid as string));
  }
  io.on("connection", (socket: Socket) => {
    const uid: string = socket.data.uid;
    let current: string | undefined;
    let stopWatch: (() => void) | undefined;
    function leave() {
      if (!current) return;
      const roomId = current;
      current = undefined;
      stopWatch?.();
      stopWatch = undefined;
      const channel = `room:${roomId}`;
      socket.leave(channel);
      if (!members(channel).has(uid)) io.to(channel).emit("presence:left", { roomId, uid });
    }
    function handle(event: string, action: (payload: any) => Promise<object>) {
      socket.on(event, async (payload, ack) => {
        if (typeof ack !== "function") return;
        try {
          ack({ ok: true, ...await action(payload) });
        } catch (error) {
          if (!(error instanceof EventError)) console.error("Fallo en evento", event, error);
          ack({ ok: false, code: error instanceof EventError ? error.message : "INTERNAL_ERROR" });
        }
      });
    }
    handle("room:join", async payload => {
      const roomId = readId(payload);
      await store.check(roomId, uid);
      if (!socket.connected) throw new EventError("DISCONNECTED");
      const channel = `room:${roomId}`;
      if (current !== roomId) {
        leave();
        const alreadyPresent = members(channel).has(uid);
        socket.join(channel);
        current = roomId;
        stopWatch = store.watch(roomId, name => {
          if (current !== roomId) return;
          if (name !== null) socket.emit("room:updated", { roomId, name });
          else {
            socket.emit("room:deleted", { roomId });
            leave();
          }
        }, () => {
          if (current === roomId) socket.conn.close(); // El cliente se reconecta y revalida.
        });
        if (!alreadyPresent) socket.to(channel).emit("presence:joined", { roomId, uid });
      }
      return { roomId, members: [...members(channel)] };
    });
    handle("room:leave", async payload => {
      if (readId(payload) !== current) throw new EventError("NOT_IN_ROOM");
      leave();
      return {};
    });
    handle("message:send", async payload => {
      const roomId = readId(payload);
      if (current !== roomId) throw new EventError("NOT_IN_ROOM");
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text || text.length > 2000) throw new EventError("INVALID_TEXT");
      const message = await store.append(roomId, uid, text);
      socket.to(`room:${roomId}`).emit("message:new", message);
      return { message };
    });
    socket.on("disconnecting", leave);
  });
}
