
import { Request, Response } from "express";
import { getUsers } from "../services/user.service";

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
