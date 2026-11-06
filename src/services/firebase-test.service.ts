// src/services/firebase-test.service.ts
import { getFirestoreSample } from "../repositories/user.repository";

export const testFirebaseConnection = async () => {
  try {
    const snapshot = await getFirestoreSample();

    if (snapshot.empty) {
      return {
        connected: true,
        message: "Conexión exitosa con Firebase, pero no se encontraron usuarios en la colección.",
        documentsFound: 0,
        user: null,
      };
    }

    const document = snapshot.docs[0];
    const userData = document.data();

    return {
      connected: true,
      message: "Conexión exitosa con Cloud Firestore",
      documentsFound: snapshot.size,
      user: {
        role: typeof userData.role === "string" ? userData.role : null,
      },
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Error al conectar con Cloud Firestore: ${error.message || "Servicio no disponible"}`,
      documentsFound: 0,
      user: null,
    };
  }
};