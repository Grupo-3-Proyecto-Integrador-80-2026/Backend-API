import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

export function createSocketServer(http: HttpServer, origin: string,
  verify: (token: string) => Promise<{ uid: string; exp: number }>) {
  const io = new Server(http, { cors: { origin }, maxHttpBufferSize: 32768 });
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token.trim()) return next(new Error("AUTH_REQUIRED"));
    try {
      const { uid, exp } = await verify(token);
      socket.data.uid = uid;
      socket.data.expiresAt = exp * 1000;
      next();
    } catch {
      next(new Error("INVALID_TOKEN"));
    }
  });
  io.on("connection", socket => {
    const timer = setTimeout(() => socket.disconnect(true), socket.data.expiresAt - Date.now());
    socket.once("disconnect", () => clearTimeout(timer));
  });
  return io;
}
