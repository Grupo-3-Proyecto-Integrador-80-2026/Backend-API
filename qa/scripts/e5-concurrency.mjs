#!/usr/bin/env node
/**
 * E5 · US-01 · Unicidad de username bajo concurrencia real.
 *
 * Por defecto SOLO hace comprobaciones previas (no escribe nada).
 * Para ejecutar contra producción se debe confirmar explícitamente:
 *
 *   CONFIRM_PRODUCTION_WRITES=YES npm run qa:e5
 *
 * El script crea dos cuentas de prueba con correos distintos y el mismo
 * username, exige exactamente un 201 y un 409 USERNAME_TAKEN, y elimina en
 * `finally` las cuentas, perfiles y reservas creados.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const API_URL = (process.env.API_URL || "https://backend-api-grupo3.onrender.com").replace(/\/$/, "");
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "";
const CONFIRM = process.env.CONFIRM_PRODUCTION_WRITES === "YES";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const EVIDENCE_ROOT = process.env.QA_EVIDENCE_DIR || resolve(ROOT, "../qa-evidence/US-01");
const OUT = resolve(EVIDENCE_ROOT, "resultados/e5-concurrency.json");

const suffix = `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 4)}`;
const username = `e5_${suffix}`.slice(0, 20);
const retryUsername = `e5r_${suffix}`.slice(0, 20);
const emails = [
  `qa.e5.${suffix}.a@correounivalle.edu.co`,
  `qa.e5.${suffix}.b@correounivalle.edu.co`
];
const password = `QaE5${suffix}!9`;
const avatarUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=QA";

const report = {
  apiUrl: API_URL,
  executedAt: new Date().toISOString(),
  mode: CONFIRM ? "WRITE" : "DRY_RUN",
  username,
  retryUsername,
  emails,
  preflight: {},
  results: [],
  requestErrors: [],
  assertions: {},
  extended: {},
  cleanup: {},
  status: "PENDING"
};

const redacted = (body) => {
  if (!body || typeof body !== "object") return body;
  const clone = structuredClone(body);
  if (clone.user) delete clone.user.email;
  if (clone.user) delete clone.user.id;
  return clone;
};

function getAdmin() {
  if (getApps().length) {
    return { auth: getAuth(), db: getFirestore() };
  }
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(ROOT, "credentials/serviceAccountKey.json");
  const serviceAccount = JSON.parse(readFileSync(credentialsPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  return { auth: getAuth(), db: getFirestore() };
}

async function preflight() {
  const availability = await fetch(
    `${API_URL}/api/users/username-availability?username=${encodeURIComponent(username)}`
  );
  report.preflight.availabilityStatus = availability.status;
  report.preflight.availabilityBody = await availability.json().catch(() => null);
  if (!report.preflight.availabilityBody?.available) {
    throw new Error("El username generado ya está ocupado; se aborta antes de escribir.");
  }

  const { auth } = getAdmin();
  for (const email of emails) {
    try {
      await auth.getUserByEmail(email);
      throw new Error(`El correo de prueba ya existe: ${email}`);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
  }
  report.preflight.emailsFree = true;
}

async function register(email, usernameToUse = username) {
  const started = Date.now();
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "QA",
      lastName: "Prueba",
      username: usernameToUse,
      email,
      password,
      avatarUrl
    }),
    signal: AbortSignal.timeout(45000)
  });
  const body = await response.json().catch(() => null);
  return { email, username: usernameToUse, status: response.status, body, durationMs: Date.now() - started };
}

async function signIn(email) {
  if (!FIREBASE_API_KEY) throw new Error("Falta FIREBASE_API_KEY para iniciar sesión.");
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      signal: AbortSignal.timeout(30000)
    }
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Login falló (${response.status}): ${body?.error?.message || "sin detalle"}`);
  return body;
}

async function getMe(idToken) {
  const response = await fetch(`${API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${idToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30000)
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function cleanup() {
  const { auth, db } = getAdmin();
  const usernames = [];
  const issues = [];
  const userIds = new Set();

  for (const result of report.results) {
    if (result.body?.user?.id) userIds.add(result.body.user.id);
  }
  if (report.extended?.retryUserId) userIds.add(report.extended.retryUserId);

  // Busca por correo por si una respuesta se perdió o ambas cuentas se crearon.
  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);
      userIds.add(user.uid);
      await auth.deleteUser(user.uid);
      usernames.push(`auth:${email}:deleted`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        usernames.push(`auth:${email}:absent`);
      } else {
        const message = `auth:${email}:error:${error.code || error.message}`;
        usernames.push(message);
        issues.push(message);
      }
    }
  }

  for (const uid of userIds) {
    try {
      await db.collection("users").doc(uid).delete();
      usernames.push(`users/${uid}:deleted`);
    } catch (error) {
      const message = `users/${uid}:error:${error.message}`;
      usernames.push(message);
      issues.push(message);
    }
  }

  for (const name of [username, retryUsername]) {
    const reservation = db.collection("usernames").doc(name.toLowerCase());
    let reservationSnapshot;
    try {
      reservationSnapshot = await reservation.get();
    } catch (error) {
      const message = `usernames/${name}:read-error:${error.message}`;
      usernames.push(message);
      issues.push(message);
      continue;
    }

    if (!reservationSnapshot.exists) {
      usernames.push(`usernames/${name}:absent`);
      continue;
    }

    const reservedUid = reservationSnapshot.get("uid");
    if (!userIds.has(reservedUid)) {
      const owner = await auth.getUser(reservedUid).catch(() => null);
      if (!owner) {
        try {
          await reservation.delete();
          usernames.push(`usernames/${name}:deleted (uid huérfano ${reservedUid})`);
        } catch (error) {
          const message = `usernames/${name}:delete-error:${error.message}`;
          usernames.push(message);
          issues.push(message);
        }
      } else {
        const message = `usernames/${name}:NO BORRADO (uid existente ${reservedUid})`;
        usernames.push(message);
        issues.push(message);
      }
    } else {
      try {
        await reservation.delete();
        usernames.push(`usernames/${name}:deleted`);
      } catch (error) {
        const message = `usernames/${name}:delete-error:${error.message}`;
        usernames.push(message);
        issues.push(message);
      }
    }
  }

  report.cleanup = { actions: usernames, userIds: [...userIds], issues };
  if (issues.length > 0) {
    throw Object.assign(new Error("Limpieza incompleta"), { issues });
  }
}

(async () => {
  let writeAttempted = false;
  try {
    await preflight();
    if (!CONFIRM) {
      report.status = "DRY_RUN_OK";
      console.log("Dry run correcto: preflight sin escrituras. Define CONFIRM_PRODUCTION_WRITES=YES para ejecutar.");
      return;
    }

    writeAttempted = true;
    const settled = await Promise.allSettled(emails.map(email => register(email)));
    report.results = settled
      .filter(result => result.status === "fulfilled")
      .map(result => result.value);
    report.requestErrors = settled
      .map((result, index) => result.status === "rejected"
        ? { email: emails[index], error: result.reason?.message || String(result.reason) }
        : null)
      .filter(Boolean);

    const statuses = report.results.map(r => r.status).sort((a, b) => a - b);
    const conflict = report.results.find(r => r.status === 409);
    report.assertions = {
      exactlyOneCreated: statuses.filter(s => s === 201).length === 1,
      exactlyOneConflict: statuses.filter(s => s === 409).length === 1,
      conflictCode: conflict?.body?.code,
      conflictField: conflict?.body?.errors?.[0]?.field,
      statuses
    };

    const coreOk = report.requestErrors.length === 0 &&
      report.assertions.exactlyOneCreated &&
      report.assertions.exactlyOneConflict &&
      conflict?.body?.code === "USERNAME_TAKEN" &&
      conflict?.body?.errors?.[0]?.field === "username";

    let extendedOk = false;
    if (coreOk) {
      const winner = report.results.find(r => r.status === 201);
      const loser = report.results.find(r => r.status === 409);
      try {
        const { auth } = getAdmin();
        const loserAuth = await auth.getUserByEmail(loser.email).catch(error => error.code);

        const winnerSession = await signIn(winner.email);
        const winnerMe = await getMe(winnerSession.idToken);

        const retry = await register(loser.email, retryUsername);
        report.extended = {
          winnerStatus: winner.status,
          winnerMeStatus: winnerMe.status,
          winnerProfileUsername: winnerMe.body?.user?.username,
          loserAuthAfterConflict: typeof loserAuth === "string" ? loserAuth : "EXISTS",
          retryStatus: retry.status,
          retryUserId: retry.body?.user?.id
        };

        const retrySession = await signIn(loser.email);
        const retryMe = await getMe(retrySession.idToken);
        report.extended.retryMeStatus = retryMe.status;
        report.extended.retryProfileUsername = retryMe.body?.user?.username;

        extendedOk =
          report.extended.winnerMeStatus === 200 &&
          report.extended.winnerProfileUsername === username &&
          report.extended.loserAuthAfterConflict === "auth/user-not-found" &&
          report.extended.retryStatus === 201 &&
          report.extended.retryMeStatus === 200 &&
          report.extended.retryProfileUsername === retryUsername;
      } catch (error) {
        report.extended.error = error.message;
      }
    }

    if (coreOk && extendedOk) report.status = "PASS";
    else if (coreOk) report.status = "PARTIAL";
    else report.status = "FAIL";

    if (report.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    report.error = { message: error.message, code: error.code };
    report.status = "ERROR";
    process.exitCode = 1;
  } finally {
    if (writeAttempted) {
      try {
        await cleanup();
      } catch (error) {
        report.cleanup = {
          ...report.cleanup,
          error: error.message,
          code: error.code,
          issues: error.issues || report.cleanup.issues
        };
        if (report.status === "PASS") report.status = "CLEANUP_FAILED";
        process.exitCode = 1;
      }
    }
    report.results = report.results.map(r => ({ ...r, body: redacted(r.body) }));
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
