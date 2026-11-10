import { Router } from "express";
import {
  getAllUsers,
  getMyProfile,
  createMyProfile,
  getUsernameAvailability
} from "../controllers/user.controller";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { verifyAdmin } from "../middlewares/admin.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  completeProfileSchema,
  usernameAvailabilitySchema
} from "../validators/user.validator";

const router = Router();

/**
 * @swagger
 * /api/users/username-availability:
 *   get:
 *     summary: Consultar si un nombre de usuario está libre
 *     description: |
 *       Sirve para avisar en el formulario mientras la persona escribe. No reserva el nombre:
 *       la unicidad se garantiza al crear la cuenta o completar el perfil.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 20
 *           pattern: '^[A-Za-z0-9_]+$'
 *         example: ana_23
 *     responses:
 *       200:
 *         description: Resultado de la consulta.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsernameAvailability'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  "/username-availability",
  validate(usernameAvailabilitySchema, "query"),
  getUsernameAvailability
);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Consultar mi perfil
 *     description: |
 *       Devuelve el perfil del usuario autenticado. Si responde 404 con `PROFILE_NOT_FOUND`,
 *       la persona entró con Google y aún no eligió su nombre de usuario: el frontend la lleva a /registro/usuario.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: El usuario aún no tiene perfil (`PROFILE_NOT_FOUND`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               code: PROFILE_NOT_FOUND
 *               message: Aún no has completado tu perfil. Elige tu nombre de usuario para continuar.
 *       500:
 *         $ref: '#/components/responses/InternalError'
 *   post:
 *     summary: Completar mi perfil después de «Continuar con Google» (US-02)
 *     description: |
 *       Guarda el perfil del usuario autenticado con el nombre de usuario elegido. El correo se toma del token;
 *       nombres, apellidos y avatar son opcionales y, si no se envían, se toman de la cuenta de Google.
 *       El nombre de usuario se reserva en una transacción.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompleteProfileRequest'
 *     responses:
 *       201:
 *         description: Perfil creado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: El nombre de usuario ya está en uso (`USERNAME_TAKEN`) o el perfil ya estaba completo (`PROFILE_EXISTS`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get("/me", verifyFirebaseToken, getMyProfile);
router.post(
  "/me",
  verifyFirebaseToken,
  validate(completeProfileSchema),
  createMyProfile
);

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
 *         description: Lista de usuarios.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 1
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: El usuario no es administrador (`FORBIDDEN`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get("/", verifyFirebaseToken, verifyAdmin, getAllUsers);

export default router;
