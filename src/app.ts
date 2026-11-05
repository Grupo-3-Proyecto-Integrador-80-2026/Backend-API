import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import firebaseTestRoutes from "./routes/firebase-test.routes";
import protectedRoutes from "./routes/protected.routes";
import userRoutes from "./routes/user.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/test/firebase", firebaseTestRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/users", userRoutes);

export default app;