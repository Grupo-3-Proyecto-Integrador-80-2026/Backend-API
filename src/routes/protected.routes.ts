
import { Router } from "express";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { getProtectedData } from "../controllers/auth-test.controller";

const router = Router();

/**
 * @swagger
 * /api/protected:
 *   get:
 *     summary: Obtener datos protegidos
 *     description: Permite acceder a información protegida cuando el usuario presenta un token válido de Firebase Authentication.
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado correctamente.
 *       401:
 *         description: Token de autenticación faltante, inválido o expirado.
 */
router.get("/", verifyFirebaseToken, getProtectedData);

export default router;
