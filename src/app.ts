import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/health", healthRoutes);

export default app;