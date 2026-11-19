const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createServer } = require("node:http");
const { io: connect } = require("socket.io-client");
const { createSocketServer } = require("../dist/socket");
const { registerRoomEvents, EventError } = require("../dist/events");

test("handshake, membresía, mensajes persistidos y presencia por UID", { timeout: 8000 }, async t => {
  const http = createServer();
  const io = createSocketServer(http, "http://localhost", async token => {
    if (token === "invalid") throw Error();
    return { uid: token, exp: Math.floor(Date.now() / 1000) + 3600 };
  });
  const a = "a".repeat(20), b = "b".repeat(20), saved = [];
  registerRoomEvents(io, {
    async check(id) { if (![a, b].includes(id)) throw new EventError("ROOM_NOT_FOUND"); },
    async append(roomId, authorId, text) {
      const message = { id: "msg", roomId, authorId, text, createdAt: new Date().toISOString() };
      saved.push(message);
      return message;
    }
  });
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  t.after(() => io.close());
  const client = token => {
    const socket = connect(`http://127.0.0.1:${http.address().port}`, {
      auth: { token }, transports: ["websocket"], reconnection: false
    });
    t.after(() => socket.disconnect());
    return socket;
  };
  for (const [token, code] of [[undefined, "AUTH_REQUIRED"], ["invalid", "INVALID_TOKEN"]]) {
    assert.equal((await once(client(token), "connect_error"))[0].message, code);
  }
  const sockets = await Promise.all(["ana", "luis", "sol", "luis"].map(async uid => {
    const socket = client(uid);
    await once(socket, "connect");
    return socket;
  }));
  const [ana, luis, sol, tab] = sockets;
  const join = (socket, roomId) => socket.emitWithAck("room:join", { roomId });
  assert.equal((await join(ana, "x".repeat(20))).code, "ROOM_NOT_FOUND");
  assert.deepEqual((await join(ana, a)).members, ["ana"]);
  const joined = once(ana, "presence:joined");
  await join(luis, a);
  assert.deepEqual((await joined)[0], { roomId: a, uid: "luis" });
  await join(sol, b);
  assert.equal((await sol.emitWithAck("message:send", { roomId: a, text: "hola" })).code, "NOT_IN_ROOM");
  let leaked = false;
  sol.on("message:new", () => { leaked = true; });
  const received = once(luis, "message:new");
  const ack = await ana.emitWithAck("message:send", { roomId: a, text: " hola ", authorId: "sol" });
  assert.deepEqual(ack.message, saved[0]);
  assert.equal(saved[0].authorId, "ana");
  assert.deepEqual((await received)[0], saved[0]);
  await join(tab, a);
  const departures = [];
  ana.on("presence:left", event => departures.push(event));
  await luis.emitWithAck("room:leave", { roomId: a });
  const left = once(ana, "presence:left");
  tab.disconnect();
  await left;
  assert.deepEqual(departures, [{ roomId: a, uid: "luis" }]);
  await join(sol, b); // Barrera: ya recibió todos los paquetes anteriores.
  assert.equal(leaked, false);
});
