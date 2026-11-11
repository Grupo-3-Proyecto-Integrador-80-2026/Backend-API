import { Request, Response } from "express";
import {
  getUsers,
  getUserProfile,
  checkUsernameAvailability,
  registerWithEmail,
  completeProfile
} from "../services/user.service";

// Obtener todos los usuarios
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const users = await getUsers();

  res.status(200).json({
    success: true,
    total: users.length,
    users
  });
};

// Obtener el perfil del usuario autenticado
export const getMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = await getUserProfile(res.locals.firebaseUser.uid);

  res.status(200).json({ success: true, user });
};

// Completar el perfil del usuario autenticado (registro con Google)
export const createMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = await completeProfile(res.locals.firebaseUser, req.body);

  res.status(201).json({ success: true, user });
};

// Registro manual con correo y contraseña
export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  const user = await registerWithEmail(req.body);

  res.status(201).json({ success: true, user });
};

// Consultar si un nombre de usuario está libre
export const getUsernameAvailability = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username } = res.locals.validated.query;
  const result = await checkUsernameAvailability(username);

  res.status(200).json({ success: true, ...result });
};
