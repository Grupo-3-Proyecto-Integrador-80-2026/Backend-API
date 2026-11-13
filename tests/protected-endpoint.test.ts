import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { DecodedIdToken } from "firebase-admin/auth";
import app from "../src/app";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({ auth: mocks, db: { collection: () => ({ doc: () => ({}) }) } }));

const token: DecodedIdToken = {
  uid: "login-qa", sub: "login-qa", aud: "qa-local", iss: "qa-local",
  iat: 0, exp: 9999999999, auth_time: 0,
  email: "estudiante@correounivalle.edu.co", email_verified: true,
  name: "Estudiante de Prueba",
  firebase: { identities: { password: ["login-qa"] }, sign_in_provider: "password" }
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

const get = (path: string, authorization?: string) => fetch(`${baseUrl}${path}`, {
  headers: authorization === undefined ? {} : { Authorization: authorization },
  signal: AbortSignal.timeout(10000)
});

describe("US-03 | endpoints privados exigen ID token (E5)", () => {
  it.each(["/api/protected", "/api/users/me"])("responde 401 AUTH_REQUIRED sin token en %s", async path => {
    mocks.verifyIdToken.mockResolvedValue(token);
    const response = await get(path);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false, code: "AUTH_REQUIRED" });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ["header sin esquema Bearer", "qa-local-placeholder"],
    ["Bearer vacío", "Bearer "],
  ])("responde 401 AUTH_REQUIRED con %s", async (_label, authorization) => {
    mocks.verifyIdToken.mockResolvedValue(token);
    const response = await get("/api/protected", authorization);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ["token con firma inválida", "auth/argument-error"],
    ["token expirado", "auth/id-token-expired"],
    ["token revocado", "auth/user-disabled"],
  ])("responde 401 INVALID_TOKEN cuando %s", async (_label, code) => {
    mocks.verifyIdToken.mockRejectedValue({ code });
    const response = await get("/api/protected", "Bearer qa-local-invalido");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ success: false, code: "INVALID_TOKEN" });
  });

  it("responde 200 con el UID y correo verificados cuando el token es válido", async () => {
    mocks.verifyIdToken.mockResolvedValue(token);
    const response = await get("/api/protected", "Bearer qa-local-valido");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      user: { uid: token.uid, email: token.email }
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledExactlyOnceWith("qa-local-valido");
  });
});
