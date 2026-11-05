
import { Router } from "express";
import { getAllUsers } from "../controllers/user.controller";
import { verifyFirebaseToken } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", verifyFirebaseToken, getAllUsers);

export default router;
