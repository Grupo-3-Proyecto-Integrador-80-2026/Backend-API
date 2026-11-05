import { Router } from "express";
import {
  getAllUsers,
  getMyProfile
} from "../controllers/user.controller";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { verifyAdmin } from "../middlewares/admin.middleware";

const router = Router();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Consultar mi perfil
 *     description: Obtiene la información del perfil del usuario autenticado.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil consultado correctamente.
 *       401:
 *         description: Token faltante, inválido o expirado.
 *       404:
 *         description: No se encontró el perfil del usuario.
 */
router.get("/me", verifyFirebaseToken, getMyProfile);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Consultar todos los usuarios
 *     description: Obtiene la lista de usuarios registrados. Disponible únicamente para administradores.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios consultada correctamente.
 *       401:
 *         description: Token faltante, inválido o expirado.
 *       403:
 *         description: El usuario no tiene permisos de administrador.
 *       404:
 *         description: No se encontró el perfil del administrador.
 */
router.get("/", verifyFirebaseToken, verifyAdmin, getAllUsers);

export default router;
