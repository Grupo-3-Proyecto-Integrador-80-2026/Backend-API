import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerSchema } from "../src/validators/user.validator";
import { registerWithEmail } from "../src/services/user.service";
import type { UserProfile } from "../src/repositories/user.repository";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(), deleteUser: vi.fn(),
  isUsernameTaken: vi.fn(), createUserProfile: vi.fn()
}));
vi.mock("../src/config/firebase", () => ({ auth: mocks }));
vi.mock("../src/repositories/user.repository", () => mocks);

const input = {
  firstName: "Ana", lastName: "Pérez", username: "ana_qa",
  email: "ana@correounivalle.edu.co", password: "Prueba123",
  avatarUrl: "https://example.com/avatar.svg"
};
const { password: _password, ...publicInput } = input;
const profile: UserProfile = {
  ...publicInput, id: "uid-qa", provider: "password", role: "student",
  createdAt: null, updatedAt: null
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isUsernameTaken.mockResolvedValue(false);
  mocks.createUser.mockResolvedValue({ uid: profile.id });
  mocks.deleteUser.mockResolvedValue(undefined);
  mocks.createUserProfile.mockResolvedValue({ status: "created", profile });
});

describe("PI-277 | US-01 | servicio de registro (Firebase y repositorio simulados)", () => {
  it("E1: crea Auth, guarda el perfil completo y no expone la contraseña", async () => {
    const result = await registerWithEmail(input);
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: input.email, password: input.password, displayName: "Ana Pérez"
    });
    expect(mocks.createUserProfile).toHaveBeenCalledWith(profile.id, {
      ...publicInput, provider: "password"
    });
    expect(result).toEqual(profile);
    expect(result).not.toHaveProperty("password");
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("E2: username ocupado produce 409 antes de crear Auth", async () => {
    mocks.isUsernameTaken.mockResolvedValue(true);
    await expect(registerWithEmail(input)).rejects.toMatchObject({
      statusCode: 409, code: "USERNAME_TAKEN",
      errors: [{ field: "username", message: expect.any(String) }]
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
  });

  it("E3: correo duplicado produce 409 con error asociado al campo", async () => {
    mocks.createUser.mockRejectedValue({ code: "auth/email-already-exists" });
    await expect(registerWithEmail(input)).rejects.toMatchObject({
      statusCode: 409, code: "EMAIL_TAKEN",
      errors: [{ field: "email", message: expect.any(String) }]
    });
    expect(mocks.createUserProfile).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("E5 parcial: conflicto transaccional posterior al prechequeo revierte Auth", async () => {
    mocks.createUserProfile.mockResolvedValue({ status: "username-taken" });
    await expect(registerWithEmail(input)).rejects.toMatchObject({ code: "USERNAME_TAKEN", statusCode: 409 });
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(profile.id);
  });

  it("un fallo de persistencia revierte Auth y conserva el error original", async () => {
    const error = new Error("Firestore unavailable");
    mocks.createUserProfile.mockRejectedValue(error);
    await expect(registerWithEmail(input)).rejects.toBe(error);
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(profile.id);
  });
});

describe("PI-277 | E4 | validación del contrato de registro", () => {
  it("acepta datos válidos y normaliza espacios/correo", () => {
    expect(registerSchema.parse({ ...input, firstName: " Ana ", email: " ANA@CORREOUNIVALLE.EDU.CO " }))
      .toMatchObject({ firstName: "Ana", email: input.email });
  });

  it.each([
    ["firstName", ""], ["lastName", " "], ["username", "ab"],
    ["username", "a".repeat(21)], ["username", "ana qa"],
    ["email", "invalido.edu.co"], ["email", "ana@gmail.com"],
    ["password", "Abc1234"], ["password", "abcdefgh"],
    ["password", "12345678"], ["password", "a1".repeat(65)],
    ["avatarUrl", "http://example.com/avatar.svg"], ["avatarUrl", ""]
  ])("rechaza %s = %s con mensaje asociado al campo", (field, value) => {
    const result = registerSchema.safeParse({ ...input, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: [field], message: expect.any(String) })
      ]));
    }
  });

  it("informa todos los campos obligatorios ausentes", () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(issue => issue.path[0]).sort()).toEqual(Object.keys(input).sort());
    }
  });
});
