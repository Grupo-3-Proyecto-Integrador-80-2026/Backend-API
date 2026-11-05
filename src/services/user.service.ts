
import {
  getAllUsers,
  getUserById
} from "../repositories/user.repository";

// Obtener todos los usuarios
export const getUsers = async () => {
  return await getAllUsers();
};

// Obtener el perfil de un usuario
export const getUserProfile = async (uid: string) => {
  return await getUserById(uid);
};
