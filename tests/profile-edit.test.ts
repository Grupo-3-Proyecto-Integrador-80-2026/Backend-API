import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../src/app";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), updateUser: vi.fn(), getUserById: vi.fn(),
  updateUserProfile: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({ auth: mocks, db: {} }));
vi.mock("../src/repositories/user.repository", () => mocks);

const profile = {
  id: "owner-1", firstName: "Ana", lastName: "Pérez", username: "ana_1",
  email: "ana@univalle.edu.co", avatarUrl: "https://example.com/avatar.svg",
  role: "student", provider: "password", createdAt: null, updatedAt: null
};
let server: Server;
let baseUrl: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifyIdToken.mockResolvedValue({ uid: profile.id });
  mocks.getUserById.mockResolvedValue(profile);
  mocks.updateUserProfile.mockResolvedValue("updated");
  mocks.updateUser.mockResolvedValue({});
});
const patch = (body: unknown, authorization = "Bearer valid") => fetch(`${baseUrl}/api/users/me`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: authorization },
  body: JSON.stringify(body)
});

describe("US-04 | perfil propio", () => {
  it("edita parcialmente y responde con el perfil persistido del UID autenticado", async () => {
    mocks.getUserById.mockResolvedValueOnce(profile).mockResolvedValueOnce({ ...profile, firstName: "María" });
    const response = await patch({ firstName: " María " });
    expect(response.status).toBe(200);
    expect(mocks.updateUserProfile).toHaveBeenCalledExactlyOnceWith(profile.id, { firstName: "María" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ success: true, user: { firstName: "María" } });
  });

  it("no permite editar otro UID ni campos del servidor", async () => {
    const response = await patch({ id: "other-user", role: "admin", firstName: "María" });
    expect(response.status).toBe(400);
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("rechaza username ocupado con 409 y campo username", async () => {
    mocks.updateUserProfile.mockResolvedValue("username-taken");
    const response = await patch({ username: "ocupado" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "USERNAME_TAKEN", errors: [{ field: "username" }] });
  });

  it("rechaza correo ocupado con 409 y no escribe Firestore", async () => {
    mocks.updateUser.mockRejectedValue({ code: "auth/email-already-exists" });
    const response = await patch({ email: "ocupado@univalle.edu.co" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "EMAIL_TAKEN", errors: [{ field: "email" }] });
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });

  it("restaura el correo en Auth si la transacción detecta username ocupado", async () => {
    mocks.updateUserProfile.mockResolvedValue("username-taken");
    const response = await patch({ email: "nuevo@univalle.edu.co", username: "ocupado" });
    expect(response.status).toBe(409);
    expect(mocks.updateUser.mock.calls).toEqual([
      [profile.id, { email: "nuevo@univalle.edu.co" }],
      [profile.id, { email: profile.email }]
    ]);
  });

  it.each([{}, { email: "invalido@gmail.com" }, { avatarUrl: "http://example.com/a" }, { username: "a" }])
    ("rechaza entrada inválida %j sin cambios", async (body) => {
      const response = await patch(body);
      expect(response.status).toBe(400);
      expect(mocks.updateUserProfile).not.toHaveBeenCalled();
      expect(mocks.updateUser).not.toHaveBeenCalled();
    });

  it("requiere token y perfil completo", async () => {
    expect((await patch({ firstName: "María" }, "")).status).toBe(401);
    mocks.getUserById.mockResolvedValue(null);
    expect((await patch({ firstName: "María" })).status).toBe(404);
    expect(mocks.updateUserProfile).not.toHaveBeenCalled();
  });
});
