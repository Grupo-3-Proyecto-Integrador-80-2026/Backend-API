import { Request, Response, NextFunction } from "express";
import { isAccountDeleting } from "../repositories/account.repository";
import { HttpError } from "../utils/http-error";

export const requireActiveAccount = async (
  _req: Request, res: Response, next: NextFunction
): Promise<void> => {
  if (await isAccountDeleting(res.locals.firebaseUser.uid)) {
    throw new HttpError(409, "ACCOUNT_DELETION_PENDING",
      "Tu cuenta tiene una eliminación pendiente. Reintenta eliminarla para completar el proceso.");
  }
  next();
};
