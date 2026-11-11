import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import "dotenv/config";

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
  throw new Error("GOOGLE_APPLICATION_CREDENTIALS no está configurada");
}

const { project_id: projectId } = JSON.parse(
  readFileSync(serviceAccountPath, "utf8")
);

// applicationDefault() lee la clave desde GOOGLE_APPLICATION_CREDENTIALS. Con cert()
// Firestore recibe la opción `credentials`, que está obsoleta y deja una advertencia en los logs.
const firebaseApp =
  getApps().length === 0
    ? initializeApp({
        credential: applicationDefault(),
        projectId,
      })
    : getApps()[0];

export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
