import { Router } from "express";
import {
  getAllUsers,
  getMyProfile,
  updateMyProfile,
  createMyProfile,
  getUsernameAvailability
} from "../controllers/user.controller";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { verifyAdmin } from "../middlewares/admin.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  completeProfileSchema,
  updateProfileSchema,
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
 *   patch:
 *     summary: Editar mi perfil (US-04)
 *     description: |
 *       Edición parcial del perfil del usuario del token. El username se reserva/libera
 *       atómicamente en Firestore, sin distinguir mayúsculas; Firebase Authentication
 *       verifica la unicidad del correo y se actualiza junto con el perfil.
 *       Los campos omitidos no cambian. Enviar `avatarUrl: null` quita el avatar.
 *       El cliente debe refrescar el ID token tras cambiar el correo.
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Perfil actualizado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Perfil incompleto o inexistente (`PROFILE_NOT_FOUND`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Nombre de usuario ocupado (`USERNAME_TAKEN`) o correo ocupado (`EMAIL_TAKEN`).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usernameTaken:
 *                 value:
 *                   success: false
 *                   code: USERNAME_TAKEN
 *                   message: Ese nombre de usuario ya está en uso.
 *                   errors:
 *                     - field: username
 *                       message: Ese nombre de usuario ya está en uso. Prueba con otro.
 *               emailTaken:
 *                 value:
 *                   success: false
 *                   code: EMAIL_TAKEN
 *                   message: Ese correo ya tiene una cuenta.
 *                   errors:
 *                     - field: email
 *                       message: Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo.
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get("/me", verifyFirebaseToken, getMyProfile);
router.patch("/me", verifyFirebaseToken, validate(updateProfileSchema), updateMyProfile);
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
