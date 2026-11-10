import app from "./app";

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Docker y Render envían SIGTERM al detener o redesplegar: se cierra el servidor sin esperar al SIGKILL
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
