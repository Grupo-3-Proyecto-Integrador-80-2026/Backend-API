# QA US-01 — PI-277 / PI-280

Desde `Backend-API/`, ejecutar:

```bash
npm ci
npm test
npm run test:typecheck
npm run build
```

Para regenerar evidencia, definir `QA_EVIDENCE_DIR` apuntando a la carpeta externa. Por defecto los scripts QA usan `../qa-evidence/US-01` respecto a la raíz del repositorio.

```bash
npm test -- --reporter=default --reporter=json \
  --outputFile="$QA_EVIDENCE_DIR/resultados/unit-tests.json"
```

Resultado 2026-11-12: **22/22 aprobadas**, typecheck y build aprobados. Las pruebas aíslan Firebase y no crean cuentas ni consultan la base de datos real.

`tests/register.test.ts`: registro, duplicados, rollback y validación. `tests/username-transaction.test.ts`: reserva y perfil en la misma transacción, username normalizado, rechazo sin escrituras ante reserva existente.

## E1–E4 contra producción

```bash
FIREBASE_API_KEY="$(sed -n 's/^VITE_FIREBASE_API_KEY=//p' ../Frontend-Collaborative-study-room-platform/frontend/.env)" \
  npm run qa:e1-e4                              # preflight, sin escrituras

FIREBASE_API_KEY="$(sed -n 's/^VITE_FIREBASE_API_KEY=//p' ../Frontend-Collaborative-study-room-platform/frontend/.env)" \
  CONFIRM_PRODUCTION_WRITES=YES npm run qa:e1-e4 # crea cuentas, verifica y limpia
```

El script `qa/scripts/e1-e4-registration.mjs` usa la API de Render y las credenciales de `credentials/serviceAccountKey.json` para comprobar Auth/Firestore y limpiar. Genera `qa-evidence/US-01/resultados/e1-e4-registration.json`.

Resultado 2026-11-12: **PASS**. E1 `201` con Auth, perfil y reserva, login y `/api/users/me` 200; E2 `409 USERNAME_TAKEN`; E3 `409 EMAIL_TAKEN`; E4 `400 VALIDATION_ERROR` sin crear Auth ni reserva. Limpieza verificada de forma independiente (correos, UID, perfiles y usernames ausentes).

## E5 contra producción

```bash
FIREBASE_API_KEY="$(sed -n 's/^VITE_FIREBASE_API_KEY=//p' ../Frontend-Collaborative-study-room-platform/frontend/.env)" \
  npm run qa:e5                              # preflight, sin escrituras

FIREBASE_API_KEY="$(sed -n 's/^VITE_FIREBASE_API_KEY=//p' ../Frontend-Collaborative-study-room-platform/frontend/.env)" \
  CONFIRM_PRODUCTION_WRITES=YES npm run qa:e5 # crea 2 cuentas, verifica y limpia
```

El script usa `qa/scripts/e5-concurrency.mjs`. Genera `qa-evidence/US-01/resultados/e5-concurrency.json`.

Ejecución del 2026-11-12: **PASS** con respuestas `201` y `409 USERNAME_TAKEN`. Además, el ganador inicia sesión y recupera su perfil (`/api/users/me` 200), el Auth del perdedor se revirtió y el perdedor puede registrarse con otro username. Auth, perfiles y ambas reservas se eliminaron y la limpieza se verificó de forma independiente.

No ejecutar el modo escritura sin autorización del equipo y sin confirmar que las cuentas de prueba pueden crearse y eliminarse.

## Documentación relacionada

- Evidencia externa e inventario: carpeta `qa-evidence/US-01/` en la raíz del workspace (`README.md`).
- Informe conjunto, matriz Gherkin, hallazgos y protocolo de producción: `Frontend-Collaborative-study-room-platform/frontend/qa/US-01.md` (repositorio hermano).
- Borrador de PR: `qa/PR-US-01.md`.
