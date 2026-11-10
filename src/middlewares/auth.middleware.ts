import { Request, Response, NextFunction } from "express";
import { auth } from "../config/firebase";
import { HttpError } from "../utils/http-error";

// Verifica el ID token de Firebase enviado como "Authorization: Bearer <token>".
// Sin token o con un token inválido, revocado o expirado responde 401.
export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authorization = req.headers.authorization ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new HttpError(
      401,
      "AUTH_REQUIRED",
      "Debes iniciar sesión para continuar."
    );
  }

  try {
    res.locals.firebaseUser = await auth.verifyIdToken(token);
  } catch (error) {
    const code = (error as { code?: string }).code;

    if (code?.startsWith("auth/")) {
      throw new HttpError(
        401,
        "INVALID_TOKEN",
        "Tu sesión no es válida o ya expiró. Inicia sesión de nuevo."
      );
    }

    // Los errores inesperados pasan al manejador global
    throw error;
  }

  next();
};
