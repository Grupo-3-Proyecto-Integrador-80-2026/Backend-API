import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../config/firebase";
import {
  getAllUsers,
  getUserById,
  isUsernameTaken,
  createUserProfile,
  type AuthProvider,
  type UserProfile
} from "../repositories/user.repository";
import type {
  RegisterInput,
  CompleteProfileInput
} from "../validators/user.validator";
import { HttpError } from "../utils/http-error";

const usernameTakenError = () =>
  new HttpError(409, "USERNAME_TAKEN", "Ese nombre de usuario ya está en uso.", [
    {
      field: "username",
      message: "Ese nombre de usuario ya está en uso. Prueba con otro."
    }
  ]);

const emailTakenError = () =>
  new HttpError(409, "EMAIL_TAKEN", "Ese correo ya tiene una cuenta.", [
    {
      field: "email",
      message: "Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo."
    }
  ]);

// Obtener todos los usuarios
export const getUsers = async () => {
  return await getAllUsers();
};

// Perfil del usuario autenticado. Si no existe (por ejemplo, entró con Google
// y aún no eligió su nombre de usuario) responde 404 PROFILE_NOT_FOUND.
export const getUserProfile = async (uid: string): Promise<UserProfile> => {
  const profile = await getUserById(uid);

  if (!profile?.username) {
    throw new HttpError(
      404,
      "PROFILE_NOT_FOUND",
      "Aún no has completado tu perfil. Elige tu nombre de usuario para continuar."
    );
  }

  return profile;
};

export const checkUsernameAvailability = async (username: string) => {
  return { username, available: !(await isUsernameTaken(username)) };
};

// US-01 · Registro manual: crea la cuenta en Firebase Authentication y el perfil
// en Firestore. Si el perfil no se puede guardar, se borra la cuenta recién creada
// para no dejar cuentas sin perfil.
export const registerWithEmail = async (
  input: RegisterInput
): Promise<UserProfile> => {
  // Revisión rápida para no crear la cuenta si el nombre ya está ocupado.
  // La garantía real de unicidad es la transacción de createUserProfile.
  if (await isUsernameTaken(input.username)) {
    throw usernameTakenError();
  }

  let uid: string;

  try {
    const user = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: `${input.firstName} ${input.lastName}`
    });
    uid = user.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code === "auth/email-already-exists") {
      throw emailTakenError();
    }

    if (code === "auth/invalid-email") {
      throw new HttpError(400, "VALIDATION_ERROR", "Revisa los datos marcados e intenta de nuevo.", [
        { field: "email", message: "Escribe un correo válido, por ejemplo nombre@correo.com." }
      ]);
    }

    throw error;
  }

  try {
    const result = await createUserProfile(uid, {
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email: input.email,
      avatarUrl: input.avatarUrl,
      provider: "password"
    });

    if (result.status !== "created") {
      throw usernameTakenError();
    }

    return result.profile;
  } catch (error) {
    await auth.deleteUser(uid).catch((deleteError) => {
      console.error("Could not roll back Firebase Auth user", uid, deleteError);
    });
    throw error;
  }
};

// Divide el nombre que entrega Google en nombres y apellidos.
// «Brayan Steven Candela Isaza» → «Brayan Steven» / «Candela Isaza».
const splitFullName = (fullName: string) => {
  const words = fullName.trim().split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return { firstName: words[0], lastName: undefined };
  }

  const firstNameWords = words.length >= 4 ? words.length - 2 : 1;

  return {
    firstName: words.slice(0, firstNameWords).join(" "),
    lastName: words.slice(firstNameWords).join(" ")
  };
};

// US-02 · Completar el perfil tras «Continuar con Google»: el correo sale del token
// verificado; nombres, apellidos y avatar se toman del cuerpo o, si faltan, de Google.
export const completeProfile = async (
  token: DecodedIdToken,
  input: CompleteProfileInput
): Promise<UserProfile> => {
  const fromGoogle = splitFullName(typeof token.name === "string" ? token.name : "");
  const firstName = input.firstName ?? fromGoogle.firstName;
  const lastName = input.lastName ?? fromGoogle.lastName;

  const missing = [
    !firstName && { field: "firstName", message: "Escribe tus nombres." },
    !lastName && { field: "lastName", message: "Escribe tus apellidos." },
    !token.email && { field: "email", message: "Tu cuenta no tiene un correo asociado." }
  ].filter((issue) => issue !== false);

  if (missing.length > 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Revisa los datos marcados e intenta de nuevo.", missing);
  }

  const provider: AuthProvider =
    token.firebase.sign_in_provider === "google.com" ? "google.com" : "password";

  const result = await createUserProfile(token.uid, {
    firstName: firstName!,
    lastName: lastName!,
    username: input.username,
    email: token.email!.toLowerCase(),
    avatarUrl: input.avatarUrl ?? (typeof token.picture === "string" ? token.picture : null),
    provider
  });

  if (result.status === "username-taken") {
    throw usernameTakenError();
  }

  if (result.status === "profile-exists") {
    throw new HttpError(409, "PROFILE_EXISTS", "Tu perfil ya está completo.");
  }

  return result.profile;
};
