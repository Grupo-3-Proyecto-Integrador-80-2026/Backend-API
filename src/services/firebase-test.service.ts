import { db } from "../config/firebase";

export const testFirebaseConnection = async () => {
  const snapshot = await db.collection("users").limit(1).get();

  return {
    connected: true,
    message: "Firebase connection successful",
    documentsFound: snapshot.size
  };
};