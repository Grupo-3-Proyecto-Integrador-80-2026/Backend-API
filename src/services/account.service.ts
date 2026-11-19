import { auth } from "../config/firebase";
import {
  markAccountDeletion, deleteAccountData, finishAccountDeletion
} from "../repositories/account.repository";

export const deleteMyAccount = async (uid: string): Promise<void> => {
  await markAccountDeletion(uid);
  await deleteAccountData(uid);
  // Auth se borra al final: si falla la limpieza, la sesión permite reintentar.
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  // La cuenta ya está eliminada. Un fallo de limpieza del marcador no convierte
  // una eliminación exitosa en un error imposible de reintentar desde el cliente.
  await finishAccountDeletion(uid).catch((error) => {
    console.error("Could not remove account deletion marker", uid, error);
  });
};
