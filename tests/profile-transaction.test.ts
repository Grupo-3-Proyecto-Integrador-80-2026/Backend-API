import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUserProfile } from "../src/repositories/user.repository";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), getAll: vi.fn(), create: vi.fn(), delete: vi.fn(),
  update: vi.fn(), runTransaction: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({
  db: {
    collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
    runTransaction: mocks.runTransaction
  }
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.runTransaction.mockImplementation((fn: (tx: typeof mocks) => Promise<unknown>) => fn(mocks));
  mocks.get.mockResolvedValue({ exists: true, get: () => "Ana_1" });
  mocks.getAll.mockResolvedValue([
    { exists: false },
    { exists: true, get: () => "owner-1" }
  ]);
});
describe("US-04 | reserva transaccional del username", () => {
  it("reserva el nuevo y libera el anterior dentro de la misma transacción", async () => {
    expect(await updateUserProfile("owner-1", { username: "ANA_2" })).toBe("updated");
    expect(mocks.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ path: "usernames/ana_2" }),
      expect.objectContaining({ path: "usernames/ana_1" })
    );
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ path: "usernames/ana_2" }), expect.objectContaining({ uid: "owner-1" })
    );
    expect(mocks.delete).toHaveBeenCalledWith(expect.objectContaining({ path: "usernames/ana_1" }));
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/owner-1" }),
      expect.objectContaining({ username: "ANA_2", usernameLower: "ana_2" })
    );
  });
  it("no escribe si el nuevo username pertenece a alguien más", async () => {
    mocks.getAll.mockResolvedValue([{ exists: true }, { exists: true, get: () => "owner-1" }]);
    expect(await updateUserProfile("owner-1", { username: "ocupado" })).toBe("username-taken");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
  it("no cambia la reserva si solo cambia el uso de mayúsculas", async () => {
    expect(await updateUserProfile("owner-1", { username: "ANA_1" })).toBe("updated");
    expect(mocks.getAll).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalled();
  });
  it("no crea perfiles ausentes ni incompletos", async () => {
    mocks.get.mockResolvedValue({ exists: false });
    expect(await updateUserProfile("owner-1", { firstName: "María" })).toBe("profile-not-found");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
