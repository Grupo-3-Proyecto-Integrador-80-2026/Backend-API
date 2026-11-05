import { Request, Response } from "express";
import { testFirebaseConnection } from "../services/firebase-test.service";

export const checkFirebaseConnection = async (
  req: Request,
  res: Response
) => {
  try {
    const result = await testFirebaseConnection();

    res.status(200).json(result);
  } catch (error) {
    console.error("Firebase connection error:", error);

    res.status(500).json({
      connected: false,
      message: "Could not connect to Firebase"
    });
  }
};