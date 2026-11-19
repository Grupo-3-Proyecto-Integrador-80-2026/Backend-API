import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../config/firebase";

// Colecciones:
// - users/{uid}: perfil del estudiante.
// - usernames/{username en minúsculas}: { uid }. Reserva el nombre de usuario;
//   como el ID del documento es el nombre, no pueden existir dos iguales.
const users = db.collection("users");
const usernames = db.collection("usernames");

export type Role = "student" | "teacher" | "admin";
export type AuthProvider = "password" | "google.com";

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  provider: AuthProvider;
  role: Role;
  createdAt: string | null;
  updatedAt: string | null;
}

export type NewUserProfile = Omit<UserProfile, "id" | "role" | "createdAt" | "updatedAt">;

export type CreateProfileResult =
  | { status: "created"; profile: UserProfile }
  | { status: "username-taken" }
  | { status: "profile-exists" };

const toIso = (value: unknown): string | null =>
  value instanceof Timestamp ? value.toDate().toISOString() : null;

const toProfile = (
  id: string,
  data: FirebaseFirestore.DocumentData
): UserProfile => {
  // usernameLower es un campo interno y no se expone
  const { usernameLower, createdAt, updatedAt, ...rest } = data;

  return {
    id,
    ...rest,
    createdAt: toIso(createdAt),
    updatedAt: toIso(updatedAt)
  } as UserProfile;
};

// Obtener todos los usuarios
export const getAllUsers = async (): Promise<UserProfile[]> => {
  const snapshot = await users.get();
  return snapshot.docs.map((doc) => toProfile(doc.id, doc.data()));
};

// Obtener un usuario por su UID
export const getUserById = async (uid: string): Promise<UserProfile | null> => {
  const doc = await users.doc(uid).get();
  return doc.exists ? toProfile(doc.id, doc.data()!) : null;
};

export const isUsernameTaken = async (username: string): Promise<boolean> => {
  const doc = await usernames.doc(username.toLowerCase()).get();
  return doc.exists;
};

// Crea el perfil y reserva el nombre de usuario en una sola transacción.
// Si dos personas piden el mismo nombre a la vez, solo una transacción lo consigue.
export const createUserProfile = async (
  uid: string,
  profile: NewUserProfile
): Promise<CreateProfileResult> => {
  const usernameLower = profile.username.toLowerCase();
  const userRef = users.doc(uid);
  const usernameRef = usernames.doc(usernameLower);

  const status = await db.runTransaction(async (tx) => {
    const [userDoc, usernameDoc] = await tx.getAll(userRef, usernameRef);

    if (userDoc.exists && userDoc.get("username")) {
      return "profile-exists" as const;
    }

    if (usernameDoc.exists) {
      return "username-taken" as const;
    }

    const now = FieldValue.serverTimestamp();

    tx.create(usernameRef, { uid, createdAt: now });
    tx.set(userRef, {
      ...profile,
      usernameLower,
      role: "student",
      createdAt: now,
      updatedAt: now
    });

    return "created" as const;
  });

  if (status !== "created") {
    return { status };
  }

  return { status, profile: (await getUserById(uid))! };
};

export const updateUserProfile = async (
  uid: string,
  changes: Partial<Pick<UserProfile, "firstName" | "lastName" | "username" | "email" | "avatarUrl">>
): Promise<"updated" | "username-taken" | "profile-not-found"> => {
  const userRef = users.doc(uid);
  return db.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists || !userDoc.get("username")) return "profile-not-found";

    const previous = (userDoc.get("username") as string).toLowerCase();
    const next = changes.username?.toLowerCase() ?? previous;
    if (next !== previous) {
      const nextRef = usernames.doc(next);
      const oldRef = usernames.doc(previous);
      // Firestore exige que TODAS las lecturas ocurran antes de la primera escritura.
      const [nextDoc, oldDoc] = await tx.getAll(nextRef, oldRef);
      if (nextDoc.exists) return "username-taken";
      // Nunca liberar la reserva de otro usuario si los datos históricos están corruptos.
      if (!oldDoc.exists || oldDoc.get("uid") !== uid) {
        throw new Error("Username reservation is missing or belongs to another user");
      }
      tx.create(nextRef, { uid, createdAt: FieldValue.serverTimestamp() });
      tx.delete(oldRef);
    }

    tx.update(userRef, {
      ...changes,
      usernameLower: next,
      updatedAt: FieldValue.serverTimestamp()
    });
    return "updated";
  });
};

export const getFirestoreSample = async () => {
  return await users.get();
};
