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
    res.status(401).json({
      message: "Invalid or expired authentication token"
    });
  }
};