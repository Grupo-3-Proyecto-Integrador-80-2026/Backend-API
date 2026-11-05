import { Router } from "express";
import { checkFirebaseConnection } from "../controllers/firebase-test.controller";

const router = Router();

router.get("/", checkFirebaseConnection);

export default router;