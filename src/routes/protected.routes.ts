import { Router } from "express";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";
import { getProtectedData } from "../controllers/auth-test.controller";

const router = Router();

router.get("/", verifyFirebaseToken, getProtectedData);

export default router;