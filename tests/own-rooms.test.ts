import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";

// Sustituir solo los servicios externos: las peticiones atraviesan Express,
// la autenticación, la validación y el repositorio de salas de producción.
const firebase = vi.hoisted(() => {
  const rows = new Map<string, Record<string, unknown>>();
  const collection = (name: string) => ({
    doc: (id = String(rows.size + 1).padStart(20, "0")) => ({ id, path: `${name}/${id}` }),
    where: (field: string, operator: string, value: string) => ({
      get: async () => ({
        docs: [...rows.entries()]
          .filter(([path, data]) => path.startsWith(`${name}/`) && operator === "==" && data[field] === value)
          .map(([path, data]) => ({ id: path.split("/")[1], get: (key: string) => data[key] }))
      })
    })
  });
  const tx = {
    get: async (ref: {path: string}) => ({ exists: rows.has(ref.path) }),
    create: (ref: {path: string}, data: Record<string, unknown>) => {
      if (rows.has(ref.path)) throw new Error("Documento existente");
      rows.set(ref.path, data);
    }
  };
  return {
    rows,
    db: { collection, runTransaction: (work: (t: typeof tx) => Promise<void>) => work(tx) },
    auth: { verifyIdToken: async (token: string) => ({ uid: token }) }
  };
});
vi.mock("../src/config/firebase", () => firebase);

let server: Server;
let url: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/rooms`;
});
afterAll(() => new Promise<void>((resolve, reject) =>
  server.close(err => err ? reject(err) : resolve())));
beforeEach(() => { firebase.rows.clear(); });

function request(uid?: string, body?: object) {
  return fetch(url, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(uid && { Authorization: `Bearer ${uid}` }) },
    body: body && JSON.stringify(body)
  });
}

describe("US-06 | Crear y visualizar salas propias", () => {
  it("devuelve una lista vacía y luego solo las salas creadas por el anfitrión", async () => {
    const empty = await request("ana");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ success: true, rooms: [] });

    const name = "a".repeat(80);
    const created = await request("ana", { name: ` ${name} `, ownerId: "luis", id: "elegido" });
    expect(created.status).toBe(201);
    const { room } = await created.json();
    expect(room).toMatchObject({ name, ownerId: "ana", id: expect.stringMatching(/^[A-Za-z0-9]{20}$/) });
    const other = await request("luis", { name });
    expect(other.status).toBe(201);
    const second = (await other.json()).room;
    expect(second.id).not.toBe(room.id);
    for (const expected of [room, second]) {
      const list = await request(expected.ownerId);
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual({ success: true, rooms: [expected] });
    }
  });

  it.each([{}, { name: "" }, { name: "   " }, { name: "a".repeat(81) }])(
    "rechaza un nombre inválido sin guardar la sala", async body => {
      const response = await request("ana", body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "INVALID_ROOM_NAME", errors: [{ field: "name", message: expect.stringContaining("80") }]
      });
      expect(firebase.rows.size).toBe(0);
    });

  it("exige sesión para crear y listar", async () => {
    expect((await request(undefined, { name: "Álgebra" })).status).toBe(401);
    expect((await request()).status).toBe(401);
    expect(firebase.rows.size).toBe(0);
  });
});
