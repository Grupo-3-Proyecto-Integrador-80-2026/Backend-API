
import { Request, Response, NextFunction } from "express";
import { getUserProfile } from "../services/user.service";

export const verifyAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    if (user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "Administrator permissions required"
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Error verifying administrator:", error);

    res.status(500).json({
      success: false,
      message: "Could not verify administrator permissions"
    });
  }
};
