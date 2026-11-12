#!/usr/bin/env node
/**
 * E1–E4 · US-01 · Registro manual contra producción.
 *
 * Por defecto solo hace preflight (no escribe). Para ejecutar:
 *   FIREBASE_API_KEY=... CONFIRM_PRODUCTION_WRITES=YES npm run qa:e1-e4
 *
 * Crea cuentas desechables, verifica E1–E4 y elimina Auth, perfiles y reservas
 * en `finally`. No imprime tokens ni contraseñas.
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
const OUT = resolve(EVIDENCE_ROOT, "resultados/e1-e4-registration.json");

const suffix = `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 4)}`;
const password = `QaE1${suffix}!9`;
const avatarUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=QA";
const e1Username = `qa1_${suffix}`.slice(0, 20);
const e3Username = `qa3_${suffix}`.slice(0, 20);
const e4Username = `qa4_${suffix}`.slice(0, 20);
const e1Email = `qa.e1.${suffix}@correounivalle.edu.co`;
const e2Email = `qa.e2.${suffix}@correounivalle.edu.co`;
const e4Email = `qa.e4.${suffix}@correounivalle.edu.co`;

const report = {
  apiUrl: API_URL,
  executedAt: new Date().toISOString(),
  mode: CONFIRM ? "WRITE" : "DRY_RUN",
  fixtures: { e1Username, e3Username, e4Username, e1Email, e2Email, e4Email },
  preflight: {},
  cases: {},
  cleanup: {},
  status: "PENDING"
};

const payload = (overrides = {}) => ({
  firstName: "QA",
  lastName: "Prueba",
  username: e1Username,
  email: e1Email,
  password,
  avatarUrl,
  ...overrides
});

function getAdmin() {
  if (getApps().length) return { auth: getAuth(), db: getFirestore() };
  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(ROOT, "credentials/serviceAccountKey.json");
  const serviceAccount = JSON.parse(readFileSync(credentialsPath, "utf8"));
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  return { auth: getAuth(), db: getFirestore() };
}

async function register(overrides = {}) {
  const started = Date.now();
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload(overrides)),
    signal: AbortSignal.timeout(45000)
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body, durationMs: Date.now() - started };
}

async function signIn(email) {
  if (!FIREBASE_API_KEY) throw new Error("Falta FIREBASE_API_KEY para el login de E1.");
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

async function preflight() {
  const { auth } = getAdmin();
  for (const username of [e1Username, e3Username, e4Username]) {
    const response = await fetch(
      `${API_URL}/api/users/username-availability?username=${encodeURIComponent(username)}`
    );
    const body = await response.json().catch(() => null);
    report.preflight[username] = { status: response.status, available: body?.available };
    if (body?.available !== true) throw new Error(`Username no disponible en preflight: ${username}`);
  }
  for (const email of [e1Email, e2Email, e4Email]) {
    try {
      await auth.getUserByEmail(email);
      throw new Error(`El correo de prueba ya existe: ${email}`);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
  }
  report.preflight.emailsFree = true;
}

async function cleanup(userIds = new Set()) {
  const { auth, db } = getAdmin();
  const actions = [];
  const issues = [];

  for (const email of [e1Email, e2Email, e4Email]) {
    try {
      const user = await auth.getUserByEmail(email);
      userIds.add(user.uid);
      await auth.deleteUser(user.uid);
      actions.push(`auth:${email}:deleted`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        actions.push(`auth:${email}:absent`);
      } else {
        const message = `auth:${email}:error:${error.code || error.message}`;
        actions.push(message);
        issues.push(message);
      }
    }
  }

  for (const uid of userIds) {
    try {
      await db.collection("users").doc(uid).delete();
      actions.push(`users/${uid}:deleted`);
    } catch (error) {
      const message = `users/${uid}:error:${error.message}`;
      actions.push(message);
      issues.push(message);
    }
  }

  for (const username of [e1Username, e3Username, e4Username]) {
    const doc = db.collection("usernames").doc(username.toLowerCase());
    let snapshot;
    try {
      snapshot = await doc.get();
    } catch (error) {
      const message = `usernames/${username}:read-error:${error.message}`;
      actions.push(message);
      issues.push(message);
      continue;
    }

    if (!snapshot.exists) {
      actions.push(`usernames/${username}:absent`);
      continue;
    }

    const reservedUid = snapshot.get("uid");
    if (userIds.has(reservedUid)) {
      try {
        await doc.delete();
        actions.push(`usernames/${username}:deleted`);
      } catch (error) {
        const message = `usernames/${username}:delete-error:${error.message}`;
        actions.push(message);
        issues.push(message);
      }
    } else {
      const owner = await auth.getUser(reservedUid).catch(() => null);
      if (!owner) {
        try {
          await doc.delete();
          actions.push(`usernames/${username}:deleted (uid huérfano ${reservedUid})`);
        } catch (error) {
          const message = `usernames/${username}:delete-error:${error.message}`;
          actions.push(message);
          issues.push(message);
        }
      } else {
        const message = `usernames/${username}:NO BORRADO (uid existente ${reservedUid})`;
        actions.push(message);
        issues.push(message);
      }
    }
  }

  report.cleanup = { actions, userIds: [...userIds], issues };
  if (issues.length > 0) {
    throw Object.assign(new Error("Limpieza incompleta"), { issues });
  }
}

(async () => {
  const userIds = new Set();
  let preflightPassed = false;
  let writeAttempted = false;
  try {
    await preflight();
    preflightPassed = true;
    if (!CONFIRM) {
      report.status = "DRY_RUN_OK";
      console.log("Dry run correcto: preflight sin escrituras. Define CONFIRM_PRODUCTION_WRITES=YES para ejecutar.");
      return;
    }

    writeAttempted = true;
    const { auth, db } = getAdmin();

    // E1
    const e1 = await register();
    if (e1.body?.user?.id) userIds.add(e1.body.user.id);
    const e1Auth = await auth.getUserByEmail(e1Email).catch(() => null);
    if (e1Auth) userIds.add(e1Auth.uid);
    const e1Profile = e1Auth ? await db.collection("users").doc(e1Auth.uid).get() : null;
    const e1Reservation = await db.collection("usernames").doc(e1Username).get();
    const e1Session = e1.status === 201 && FIREBASE_API_KEY ? await signIn(e1Email) : null;
    const e1Me = e1Session ? await getMe(e1Session.idToken) : null;

    report.cases.E1 = {
      status: e1.status,
      user: e1.body?.user,
      noPasswordInResponse: e1.body?.user ? !("password" in e1.body.user) : null,
      authUserExists: Boolean(e1Auth),
      authUidMatches: Boolean(e1Auth && e1.body?.user?.id === e1Auth.uid),
      profileExists: Boolean(e1Profile?.exists),
      profileUsernameLower: e1Profile?.get("usernameLower") ?? null,
      reservationExists: e1Reservation.exists,
      reservationUid: e1Reservation.get("uid") ?? null,
      loginStatus: e1Session ? 200 : null,
      meStatus: e1Me?.status ?? null,
      meUsername: e1Me?.body?.user?.username ?? null,
      passed:
        e1.status === 201 &&
        e1.body?.user?.username === e1Username &&
        e1.body?.user?.email === e1Email &&
        !("password" in (e1.body?.user || {})) &&
        Boolean(e1Auth) &&
        e1.body?.user?.id === e1Auth?.uid &&
        Boolean(e1Profile?.exists) &&
        e1Profile?.get("usernameLower") === e1Username &&
        e1Reservation.exists &&
        e1Reservation.get("uid") === e1Auth?.uid &&
        e1Me?.status === 200 &&
        e1Me?.body?.user?.username === e1Username
    };

    // E2
    const e2 = await register({ email: e2Email });
    const e2Auth = await auth.getUserByEmail(e2Email).catch(error => error.code);
    report.cases.E2 = {
      status: e2.status,
      code: e2.body?.code,
      field: e2.body?.errors?.[0]?.field,
      newAuthUser: typeof e2Auth === "string" ? e2Auth : "EXISTS",
      passed:
        e2.status === 409 &&
        e2.body?.code === "USERNAME_TAKEN" &&
        e2.body?.errors?.[0]?.field === "username" &&
        e2Auth === "auth/user-not-found"
    };

    // E3
    const e3 = await register({ username: e3Username, email: e1Email });
    const e3Reservation = await db.collection("usernames").doc(e3Username).get();
    report.cases.E3 = {
      status: e3.status,
      code: e3.body?.code,
      field: e3.body?.errors?.[0]?.field,
      newReservationExists: e3Reservation.exists,
      passed:
        e3.status === 409 &&
        e3.body?.code === "EMAIL_TAKEN" &&
        e3.body?.errors?.[0]?.field === "email" &&
        !e3Reservation.exists
    };

    // E4
    const e4EmailInvalid = await register({ username: e4Username, email: "invalido.edu.co" });
    const e4PasswordShort = await register({ username: e4Username, email: e4Email, password: "Abc1" });
    // Envío vacío real: body sin campos.
    const emptyResponse = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(45000)
    });
    const emptyBody = await emptyResponse.json().catch(() => null);
    const emptyFields = (emptyBody?.errors || []).map(error => error.field).sort();
    const e4Auth = await auth.getUserByEmail(e4Email).catch(error => error.code);
    const e4Reservation = await db.collection("usernames").doc(e4Username).get();

    report.cases.E4 = {
      invalidEmail: {
        status: e4EmailInvalid.status,
        code: e4EmailInvalid.body?.code,
        field: e4EmailInvalid.body?.errors?.[0]?.field
      },
      shortPassword: {
        status: e4PasswordShort.status,
        code: e4PasswordShort.body?.code,
        field: e4PasswordShort.body?.errors?.[0]?.field
      },
      emptyBody: {
        status: emptyResponse.status,
        code: emptyBody?.code,
        fields: emptyFields
      },
      noAuthUserForE4Email: typeof e4Auth === "string" ? e4Auth : "EXISTS",
      noReservationForE4Username: !e4Reservation.exists,
      passed:
        e4EmailInvalid.status === 400 &&
        e4EmailInvalid.body?.code === "VALIDATION_ERROR" &&
        e4EmailInvalid.body?.errors?.[0]?.field === "email" &&
        e4PasswordShort.status === 400 &&
        e4PasswordShort.body?.code === "VALIDATION_ERROR" &&
        e4PasswordShort.body?.errors?.[0]?.field === "password" &&
        emptyResponse.status === 400 &&
        emptyBody?.code === "VALIDATION_ERROR" &&
        ["firstName", "lastName", "username", "email", "password", "avatarUrl"].every(field => emptyFields.includes(field)) &&
        e4Auth === "auth/user-not-found" &&
        !e4Reservation.exists
    };

    const allPassed = Object.values(report.cases).every(item => item.passed === true);
    report.status = allPassed ? "PASS" : "FAIL";
    if (!allPassed) process.exitCode = 1;
  } catch (error) {
    report.error = { message: error.message, code: error.code };
    report.status = "ERROR";
    process.exitCode = 1;
  } finally {
    if (preflightPassed && writeAttempted) {
      try {
        await cleanup(userIds);
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
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
