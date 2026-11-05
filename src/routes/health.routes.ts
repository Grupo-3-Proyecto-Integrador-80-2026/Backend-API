
import { Router } from "express";
import { getHealth } from "../controllers/health.controller";

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Verificar el estado del backend
 *     description: Comprueba que el servidor esté funcionando correctamente.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: El servidor está funcionando correctamente.
 */
router.get("/", getHealth);

export default router;
