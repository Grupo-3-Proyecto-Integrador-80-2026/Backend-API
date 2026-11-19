import { createServer } from "node:http";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createSocketServer } from "./socket";
import { getFirestore } from "firebase-admin/firestore";
import { registerRoomEvents } from "./events";
import { firestoreRooms } from "./store";

const origin = process.env.FRONTEND_ORIGIN;
if (!origin) throw new Error("Configura FRONTEND_ORIGIN con el origen del frontend.");
const app = initializeApp();
const http = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404).end();
  }
});
const io = createSocketServer(http, origin, token => getAuth(app).verifyIdToken(token, true));
registerRoomEvents(io, firestoreRooms(getFirestore(app)));
http.listen(Number(process.env.PORT || 3001), "0.0.0.0");
process.once("SIGTERM", () => io.close());
