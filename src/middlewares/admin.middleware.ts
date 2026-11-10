import { Request, Response, NextFunction } from "express";
import { getUserById } from "../repositories/user.repository";
import { HttpError } from "../utils/http-error";

export const verifyAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user = await getUserById(res.locals.firebaseUser.uid);

  if (user?.role !== "admin") {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "No tienes permisos para realizar esta acción."
    );
  }

  next();
};
