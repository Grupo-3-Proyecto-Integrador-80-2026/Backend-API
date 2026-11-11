import { Router } from "express";
import { register } from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { registerSchema } from "../validators/user.validator";

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Crear cuenta con correo y contraseña (US-01)
 *     description: |
 *       Crea la cuenta en Firebase Authentication y guarda el perfil en Firestore.
 *       El nombre de usuario se reserva en una transacción, así que nunca quedan dos cuentas con el mismo
 *       (sin distinguir mayúsculas). Si el perfil no se puede guardar, la cuenta se borra.
 *
 *       Después de crear la cuenta, el frontend inicia sesión con `signInWithEmailAndPassword` de Firebase.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Cuenta y perfil creados.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: El nombre de usuario (`USERNAME_TAKEN`) o el correo (`EMAIL_TAKEN`) ya están registrados.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usernameTaken:
 *                 summary: Nombre de usuario ocupado
 *                 value:
 *                   success: false
 *                   code: USERNAME_TAKEN
 *                   message: Ese nombre de usuario ya está en uso.
 *                   errors:
 *                     - field: username
 *                       message: Ese nombre de usuario ya está en uso. Prueba con otro.
 *               emailTaken:
 *                 summary: Correo ya registrado
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
router.post("/register", validate(registerSchema), register);

export default router;
