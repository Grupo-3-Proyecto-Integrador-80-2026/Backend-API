
import { Router } from "express";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { getProtectedData } from "../controllers/auth-test.controller";

const router = Router();

/**
 * @swagger
 * /api/protected:
 *   get:
 *     summary: Verificar la sesión
 *     description: Ruta privada de prueba. Responde 200 con el UID y el correo si el ID token de Firebase es válido, y 401 si no lo es.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión válida.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Sesión verificada.
 *               user:
 *                 uid: Xb3kP9mQ2rT7vW1yZ4aC6dE8fG0h
 *                 email: ana.gomez@correounivalle.edu.co
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", verifyFirebaseToken, getProtectedData);

export default router;
