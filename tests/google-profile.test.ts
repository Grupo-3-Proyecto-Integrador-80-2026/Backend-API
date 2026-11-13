import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { DecodedIdToken } from "firebase-admin/auth";
import app from "../src/app";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), getUserById: vi.fn(), createUserProfile: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({ auth: mocks, db: {} }));
vi.mock("../src/repositories/user.repository", () => mocks);

const token: DecodedIdToken = {
  uid: "google-qa", sub: "google-qa", aud: "qa-local", iss: "qa-local",
  iat: 0, exp: 9999999999, auth_time: 0,
  email: "ANA@example.edu.co", email_verified: true,
  name: "Ana María Pérez Gómez", picture: "https://example.com/avatar.png",
  firebase: { identities: { "google.com": ["google-qa"] }, sign_in_provider: "google.com" }
};
const profile = {
  id: token.uid, firstName: "Ana María", lastName: "Pérez Gómez", username: "ana_qa",
  email: "ana@example.edu.co", avatarUrl: token.picture, provider: "google.com",
  role: "student", createdAt: null, updatedAt: null
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
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifyIdToken.mockResolvedValue(token);
  mocks.getUserById.mockResolvedValue(null);
  mocks.createUserProfile.mockResolvedValue({ status: "created", profile });
});

const request = (body?: unknown, authorization = "Bearer qa-local-placeholder") => fetch(`${baseUrl}/api/users/me`, {
  method: body === undefined ? "GET" : "POST",
  headers: { "Content-Type": "application/json", Authorization: authorization },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

describe("US-02 | HTTP real local; Firebase y repositorio simulados", () => {
  it("E1: verifica Bearer y responde PROFILE_NOT_FOUND si falta el perfil", async () => {
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "PROFILE_NOT_FOUND" });
    expect(mocks.verifyIdToken).toHaveBeenCalledExactlyOnceWith("qa-local-placeholder");
    expect(mocks.getUserById).toHaveBeenCalledExactlyOnceWith(token.uid);
  });

  it("E1/E3: un documento sin username sigue siendo incompleto", async () => {
    mocks.getUserById.mockResolvedValue({ ...profile, username: "" });
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "PROFILE_NOT_FOUND" });
  });

  it("E2: crea el perfil con nombre, avatar y correo del token verificado", async () => {
    const response = await request({ username: " ana_qa ", email: "spoof@example.edu.co", uid: "otro", role: "admin" });
    expect(response.status).toBe(201);
    expect(mocks.createUserProfile).toHaveBeenCalledExactlyOnceWith(token.uid, {
      firstName: "Ana María", lastName: "Pérez Gómez", username: "ana_qa",
      email: "ana@example.edu.co", avatarUrl: token.picture, provider: "google.com"
    });
    expect(await response.json()).toEqual({ success: true, user: profile });
    mocks.getUserById.mockResolvedValue(profile);
    const read = await request();
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({ success: true, user: profile });
  });

  it.each(["", "ab", "a".repeat(21), "ana qa", "niña"])("E4: formato inválido %s no persiste", async username => {
    const response = await request({ username });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "VALIDATION_ERROR", errors: expect.arrayContaining([
      expect.objectContaining({ field: "username" })
    ]) });
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });

  it("E4: la colisión transaccional responde 409 asociado al campo", async () => {
    mocks.createUserProfile.mockResolvedValue({ status: "username-taken" });
    const response = await request({ username: "ana_qa" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "USERNAME_TAKEN", errors: [
      { field: "username", message: expect.any(String) }
    ] });
  });

  it("un perfil ya completo responde PROFILE_EXISTS", async () => {
    mocks.createUserProfile.mockResolvedValue({ status: "profile-exists" });
    const response = await request({ username: "otro_qa" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PROFILE_EXISTS" });
  });

  it("rechaza el correo no institucional sin persistir", async () => {
    mocks.verifyIdToken.mockResolvedValue({ ...token, email: "qa@example.com" });
    const response = await request({ username: "ana_qa" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_EMAIL_DOMAIN" });
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });

  it("nombres ausentes generan errores de campo y pueden completarse", async () => {
    mocks.verifyIdToken.mockResolvedValue({ ...token, name: undefined, picture: undefined });
    const response = await request({ username: "ana_qa" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errors: [
      { field: "firstName", message: expect.any(String) },
      { field: "lastName", message: expect.any(String) }
    ] });
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
    expect((await request({ username: "ana_qa", firstName: "Ana", lastName: "Pérez" })).status).toBe(201);
    expect(mocks.createUserProfile).toHaveBeenCalledWith(token.uid, expect.objectContaining({
      firstName: "Ana", lastName: "Pérez", avatarUrl: null
    }));
  });

  it.each([undefined, { username: "ana_qa" }])("sin Bearer no permite leer ni crear: %s", async body => {
    const response = await request(body, "");
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("un token inválido no permite persistir", async () => {
    mocks.verifyIdToken.mockRejectedValue({ code: "auth/id-token-expired" });
    const response = await request({ username: "ana_qa" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "INVALID_TOKEN" });
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });
});
