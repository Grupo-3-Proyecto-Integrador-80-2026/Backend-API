import { Request, Response, NextFunction } from "express";
import { getAuth } from "firebase-admin/auth";

export const verifyFirebaseToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    // Comprobar que exista el encabezado Authorization
    if (!authorization || !authorization.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication token is required"
      });
      return;
    }

    // Extraer el token
    const token = authorization.split(" ")[1];

    // Verificar el token con Firebase
    const decodedToken = await getAuth().verifyIdToken(token);

    // Guardar los datos del usuario para utilizarlos después
    res.locals.firebaseUser = decodedToken;

    next();

  } catch (error) {
    const firebaseError = error as { code?: string };

    const invalidTokenErrors = [
      "auth/argument-error",
      "auth/invalid-id-token",
      "auth/id-token-expired"
    ];

    if (firebaseError.code && invalidTokenErrors.includes(firebaseError.code)) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token"
      });
      return;
    }

    // Los errores inesperados pasan al middleware global
    throw error;
  }
};