import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/http-error";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
    return;
  }

  // Errores de express.json(): cuerpo con JSON mal formado o demasiado grande
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      code: "INVALID_JSON",
      message: "Los datos enviados no tienen un formato JSON válido."
    });
    return;
  }

  if (err?.type === "entity.too.large") {
    res.status(413).json({
      success: false,
      code: "PAYLOAD_TOO_LARGE",
      message: "Los datos enviados son demasiado grandes."
    });
    return;
  }

  // Solo los errores inesperados se registran en los logs del servidor
  console.error("Unexpected error:", err);

  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Ocurrió un error inesperado. Intenta de nuevo en unos minutos."
  });
};
