import { Request, Response, NextFunction } from "express";

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `La ruta ${req.method} ${req.originalUrl} no existe.`
  });
};
