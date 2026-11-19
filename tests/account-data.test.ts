import { beforeEach, expect, it, vi } from "vitest";
import { deleteAccountData } from "../src/repositories/account.repository";

const mocks = vi.hoisted(() => ({ get: vi.fn(), recursiveDelete: vi.fn(), where: vi.fn() }));
vi.mock("../src/config/firebase", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
      where: (field: string, op: string, value: string) => {
        mocks.where(name, field, op, value);
        return { limit: () => ({ get: mocks.get }) };
      }
    }),
    recursiveDelete: mocks.recursiveDelete
  }
}));
beforeEach(() => { vi.resetAllMocks(); });
const page = (...paths: string[]) => ({
  empty: paths.length === 0,
  docs: paths.map(path => ({ id: path.split("/").at(-1), ref: { path } }))
});
it("borra mensajes de salas propias, salas, mensajes propios, reservas y perfil en orden", async () => {
  mocks.get
    .mockResolvedValueOnce(page("rooms/room1"))
    .mockResolvedValueOnce(page("messages/guest-message"))
    .mockResolvedValueOnce(page())
    .mockResolvedValueOnce(page())
    .mockResolvedValueOnce(page("messages/own-message"))
    .mockResolvedValueOnce(page())
    .mockResolvedValueOnce(page("usernames/ana"))
    .mockResolvedValueOnce(page());
  await deleteAccountData("owner");
  expect(mocks.where.mock.calls).toEqual([
    ["rooms", "ownerId", "==", "owner"],
    ["messages", "roomId", "==", "room1"],
    ["messages", "authorId", "==", "owner"],
    ["usernames", "uid", "==", "owner"]
  ]);
  expect(mocks.recursiveDelete.mock.calls.map(([ref]) => ref.path)).toEqual([
    "messages/guest-message", "rooms/room1", "messages/own-message", "usernames/ana", "users/owner"
  ]);
});
it("un reintento sin datos asociados sigue borrando el perfil de forma idempotente", async () => {
  mocks.get.mockResolvedValue(page());
  await deleteAccountData("owner");
  expect(mocks.recursiveDelete).toHaveBeenCalledExactlyOnceWith({ path: "users/owner" });
});
