import { Request, Response } from "express";

export const getProtectedData = (
  req: Request,
  res: Response
) => {
  const user = res.locals.firebaseUser;

  res.status(200).json({
    success: true,
    message: "Sesión verificada.",
    user: {
      uid: user.uid,
      email: user.email
    }
  });
};