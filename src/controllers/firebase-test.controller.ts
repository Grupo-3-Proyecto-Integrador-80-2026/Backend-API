import { Request, Response } from "express";
import { testFirebaseConnection } from "../services/firebase-test.service";

export const checkFirebaseConnection = async (
  req: Request,
  res: Response
): Promise<void> => {
  const result = await testFirebaseConnection();

  // Si Firestore no responde, se informa con 503 para que el cliente muestre el estado de error
  res.status(result.connected ? 200 : 503).json(result);
};