
import { Router } from "express";
import { checkFirebaseConnection } from "../controllers/firebase-test.controller";

const router = Router();

/**
 * @swagger
 * /api/test/firebase:
 *   get:
 *     summary: Verificar conexión con Firebase
 *     description: Comprueba que el backend pueda conectarse correctamente con Firebase y Firestore.
 *     tags:
 *       - Firebase
 *     responses:
 *       200:
 *         description: Conexión con Firebase realizada correctamente.
 *       500:
 *         description: Error al conectar con Firebase.
 */
router.get("/", checkFirebaseConnection);

export default router;
