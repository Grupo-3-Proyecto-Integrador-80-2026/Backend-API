
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
 *       503:
 *         description: Firestore no responde; el cuerpo incluye connected en false y un mensaje con el error.
 */
router.get("/", checkFirebaseConnection);

export default router;
