
import { getAllUsers } from "../repositories/user.repository";

export const getUsers = async () => {
  return await getAllUsers();
};
