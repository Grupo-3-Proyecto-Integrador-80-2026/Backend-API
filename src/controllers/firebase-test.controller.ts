import { Request, Response } from "express";
import { testFirebaseConnection } from "../services/firebase-test.service";

export const checkFirebaseConnection = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = await testFirebaseConnection();

  res.status(200).json(result);
};