
import { db } from "../config/firebase";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Obtener todos los usuarios
export const getAllUsers = async (): Promise<User[]> => {
  const snapshot = await db.collection("users").get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  })) as User[];
};

// Obtener un usuario por su UID
export const getUserById = async (
  uid: string
): Promise<User | null> => {
  const doc = await db.collection("users").doc(uid).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  } as User;
};

export const getFirestoreSample = async () => {
  return await db.collection("users").get();
};