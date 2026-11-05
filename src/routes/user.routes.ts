
import { Router } from "express";
import {
  getAllUsers,
  getMyProfile
} from "../controllers/user.controller";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { verifyAdmin } from "../middlewares/admin.middleware";

const router = Router();

// Consultar el perfil del usuario autenticado
router.get("/me", verifyFirebaseToken, getMyProfile);

// Consultar todos los usuarios (solo administradores)
router.get("/", verifyFirebaseToken, verifyAdmin, getAllUsers);

export default router;
