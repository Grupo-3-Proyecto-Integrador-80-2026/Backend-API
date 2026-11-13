import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUserProfile } from "../src/repositories/user.repository";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(), create: vi.fn(), set: vi.fn(), get: vi.fn(), runTransaction: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({
  db: {
    collection: (collection: string) => ({
      doc: (id: string) => ({ path: `${collection}/${id}`, id, get: mocks.get })
    }),
    runTransaction: mocks.runTransaction
  }
}));
const input = {
  firstName: "Ana", lastName: "Pérez", username: "Ana_QA",
  email: "ana@correounivalle.edu.co", avatarUrl: "https://example.com/avatar.svg",
  provider: "password" as const
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.runTransaction.mockImplementation((callback: (tx: typeof mocks) => Promise<unknown>) => callback(mocks));
  mocks.getAll.mockResolvedValue([{ exists: false }, { exists: false }]);
  mocks.get.mockResolvedValue({ exists: true, id: "uid-qa", data: () => ({ ...input, role: "student" }) });
});

describe("PI-277 | E5 parcial | contrato de transacción (Firestore simulado)", () => {
  it("reserva el username normalizado y el perfil dentro de la misma transacción", async () => {
    await expect(createUserProfile("uid-qa", input)).resolves.toMatchObject({ status: "created" });
    expect(mocks.runTransaction).toHaveBeenCalledOnce();
    expect(mocks.getAll).toHaveBeenCalledWith(
      expect.objectContaining({ path: "users/uid-qa" }),
      expect.objectContaining({ path: "usernames/ana_qa" })
    );
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ path: "usernames/ana_qa" }),
      expect.objectContaining({ uid: "uid-qa" })
    );
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ path: "users/uid-qa" }),
      expect.objectContaining({ ...input, usernameLower: "ana_qa", role: "student" })
    );
  });

  it("si la reserva existe al leer la transacción, no escribe ningún documento", async () => {
    mocks.getAll.mockResolvedValue([{ exists: false }, { exists: true }]);
    await expect(createUserProfile("uid-qa", input)).resolves.toEqual({ status: "username-taken" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("US-02: un perfil Google completo no se reemplaza ni reserva otro username", async () => {
    mocks.getAll.mockResolvedValue([{ exists: true, get: () => "username_anterior" }, { exists: false }]);
    await expect(createUserProfile("uid-qa", { ...input, provider: "google.com" }))
      .resolves.toEqual({ status: "profile-exists" });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("US-02: completa un documento Google sin username y reserva atómicamente", async () => {
    mocks.getAll.mockResolvedValue([{ exists: true, get: () => undefined }, { exists: false }]);
    await expect(createUserProfile("uid-qa", { ...input, provider: "google.com" }))
      .resolves.toMatchObject({ status: "created" });
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ path: "usernames/ana_qa" }), expect.objectContaining({ uid: "uid-qa" })
    );
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ path: "users/uid-qa" }), expect.objectContaining({ provider: "google.com" })
    );
  });
});
