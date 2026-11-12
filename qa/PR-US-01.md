# Borrador — test(auth): cubrir registro manual y reserva de username

Rama sugerida: `feature/US-01-qa-registro`, destino `main`.

## Resumen
- Vitest con Firebase y repositorio simulados para el servicio.
- Validación del esquema de registro y contrato transaccional del repositorio.
- Duplicados, rollback, normalización y datos inválidos.
- Automatización E1–E4 y E5 contra producción con limpieza verificada.

## Historias asociadas
PI-210 / US-01; PI-277 y PI-280. Auditoría PI-278 documentada en frontend.

## Pruebas
- **22/22** pruebas unitarias aprobadas.
- `npm run test:typecheck` y `npm run build`: aprobados.
- Evidencia: `qa-evidence/US-01/resultados/unit-tests.json`.
- Concurrencia real en Firestore: **PASS** con E5 (201/409, login del ganador, reintento del perdedor y limpieza).
- E1–E4 reales contra Render: **PASS**.
- Accesibilidad (teclado/lector/axe): ver informe frontend; auditoría automatizada local aprobada, lector de pantalla pendiente.

## Evidencia en producción
- API `https://backend-api-grupo3.onrender.com`: health 200 y Swagger 200 el 2026-11-12.
- E1: `POST /api/auth/register` → `201`; Auth, `users/{uid}` y `usernames/{username}` creados; login y `GET /api/users/me` 200.
- E2: username ocupado → `409 USERNAME_TAKEN`, campo `username`, sin Auth nuevo.
- E3: correo ocupado → `409 EMAIL_TAKEN`, campo `email`, sin reserva nueva.
- E4: correo inválido, contraseña corta y body vacío → `400 VALIDATION_ERROR`; sin Auth ni reserva.
- E5: dos `POST` concurrentes → `201` + `409 USERNAME_TAKEN`; Auth del perdedor revertido; reintento con otro username `201`; limpieza verificada de forma independiente.
- Informes: `qa-evidence/US-01/resultados/e1-e4-registration.json` y `e5-concurrency.json`.
- Scripts: `qa/scripts/e1-e4-registration.mjs` (`npm run qa:e1-e4`) y `qa/scripts/e5-concurrency.mjs` (`npm run qa:e5`). Modo escritura solo con `CONFIRM_PRODUCTION_WRITES=YES`; limpieza en `finally`.
- SHA desplegado, capturas/video y URL de PR: PENDIENTE.

## Estado de revisión
Contrato y flujos de registro aprobados contra producción. Falta registrar SHA, adjuntar evidencia visual y publicar el PR. No declarar la historia aceptada todavía.
