
import { Request, Response } from "express";
import {
  getUsers,
  getUserProfile
} from "../services/user.service";

// Obtener todos los usuarios
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const users = await getUsers();

    res.status(200).json({
      success: true,
      total: users.length,
      users
    });
  } catch (error) {
    console.error("Error getting users:", error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve users"
    });
  }
};

// Obtener el perfil del usuario autenticado
export const getMyProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const uid = res.locals.firebaseUser.uid;
    const user = await getUserProfile(uid);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User profile not found"
      });
      return;
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error("Error getting user profile:", error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve user profile"
    });
  }
};
