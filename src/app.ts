import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import firebaseTestRoutes from "./routes/firebase-test.routes";
import protectedRoutes from "./routes/protected.routes";
import userRoutes from "./routes/user.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { notFoundHandler } from "./middlewares/not-found.middleware";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/test/firebase", firebaseTestRoutes);
app.use("/api/protected", protectedRoutes);
app.use("/api/users", userRoutes);

// Swagger documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware para rutas inexistentes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;