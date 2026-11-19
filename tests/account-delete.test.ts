import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import app from "../src/app";
import { deleteMyAccount } from "../src/services/account.service";

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), deleteUser: vi.fn(), markAccountDeletion: vi.fn(),
  deleteAccountData: vi.fn(), finishAccountDeletion: vi.fn(), isAccountDeleting: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({ auth: mocks, db: {} }));
vi.mock("../src/repositories/user.repository", () => ({}));
vi.mock("../src/repositories/account.repository", () => mocks);
let server: Server;
let url: string;
beforeAll(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/users/me`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.verifyIdToken.mockResolvedValue({ uid: "owner" });
  mocks.markAccountDeletion.mockResolvedValue(undefined);
  mocks.deleteAccountData.mockResolvedValue(undefined);
  mocks.deleteUser.mockResolvedValue(undefined);
  mocks.finishAccountDeletion.mockResolvedValue(undefined);
});
describe("US-05 | eliminación de cuenta", () => {
  it("DELETE usa solo el UID autenticado y devuelve 204 sin cuerpo", async () => {
    const response = await fetch(`${url}?uid=other`, {
      method: "DELETE", headers: { Authorization: "Bearer valid" }
    });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(mocks.verifyIdToken).toHaveBeenCalledWith("valid", true);
    expect(mocks.deleteAccountData).toHaveBeenCalledWith("owner");
    expect(mocks.deleteUser).toHaveBeenCalledWith("owner");
    expect(mocks.deleteAccountData.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.deleteUser.mock.invocationCallOrder[0]);
  });
  it("sin sesión no borra nada", async () => {
    expect((await fetch(url, { method: "DELETE" })).status).toBe(401);
    expect(mocks.markAccountDeletion).not.toHaveBeenCalled();
  });
  it("rechaza tokens de cuentas eliminadas o revocadas", async () => {
    mocks.verifyIdToken.mockRejectedValue({ code: "auth/user-not-found" });
    expect((await fetch(url, { method: "DELETE", headers: { Authorization: "Bearer old" } })).status).toBe(401);
    expect(mocks.deleteAccountData).not.toHaveBeenCalled();
  });
  it("un fallo en Firestore conserva Auth y permite reintentar", async () => {
    mocks.deleteAccountData.mockRejectedValueOnce(new Error("offline"));
    await expect(deleteMyAccount("owner")).rejects.toThrow("offline");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.finishAccountDeletion).not.toHaveBeenCalled();
    await expect(deleteMyAccount("owner")).resolves.toBeUndefined();
  });
  it("un fallo en Auth mantiene el marcador y puede reintentarse", async () => {
    mocks.deleteUser.mockRejectedValueOnce(new Error("Auth offline"));
    await expect(deleteMyAccount("owner")).rejects.toThrow("Auth offline");
    expect(mocks.finishAccountDeletion).not.toHaveBeenCalled();
    await expect(deleteMyAccount("owner")).resolves.toBeUndefined();
  });
  it("tolera una cuenta Auth ya eliminada", async () => {
    mocks.deleteUser.mockRejectedValue({ code: "auth/user-not-found" });
    await expect(deleteMyAccount("owner")).resolves.toBeUndefined();
    expect(mocks.finishAccountDeletion).toHaveBeenCalledWith("owner");
  });
  it.each(["POST", "PATCH"])("bloquea %s del perfil durante una eliminación pendiente", async (method) => {
    mocks.isAccountDeleting.mockResolvedValue(true);
    const response = await fetch(url, {
      method, headers: { Authorization: "Bearer valid", "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ana_1" })
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_DELETION_PENDING" });
  });
});
