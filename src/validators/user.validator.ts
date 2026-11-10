import { z } from "zod";

// Texto obligatorio con mensaje propio cuando falta o no es texto
const requiredText = (missingMessage: string) =>
  z.string({ error: missingMessage }).trim();

const personName = (label: "nombres" | "apellidos") =>
  requiredText(`Escribe tus ${label}.`)
    .min(1, `Escribe tus ${label}.`)
    .max(50, `Tus ${label} pueden tener máximo 50 caracteres.`)
    .regex(
      /^[\p{L}][\p{L}' -]*$/u,
      `Tus ${label} solo pueden tener letras, espacios, guiones (-) y apóstrofos (').`
    );

// Nombre de usuario: 3 a 20 caracteres, letras sin tilde, números y guion bajo.
// La unicidad no distingue mayúsculas: «Ana_23» y «ana_23» son el mismo nombre.
export const usernameSchema = requiredText("Escribe un nombre de usuario.")
  .min(3, "Tu nombre de usuario debe tener al menos 3 caracteres.")
  .max(20, "Tu nombre de usuario puede tener máximo 20 caracteres.")
  .regex(
    /^[A-Za-z0-9_]+$/,
    "Usa solo letras sin tilde, números y guion bajo (_), sin espacios."
  );

const emailSchema = requiredText("Escribe tu correo.")
  .toLowerCase()
  .min(1, "Escribe tu correo.")
  .max(254, "Tu correo puede tener máximo 254 caracteres.")
  .pipe(z.email("Escribe un correo válido, por ejemplo nombre@correo.com."));

// Política de contraseña (debe coincidir con la que se muestra en el formulario)
const passwordSchema = z
  .string({ error: "Escribe una contraseña." })
  .min(8, "Tu contraseña debe tener al menos 8 caracteres.")
  .max(128, "Tu contraseña puede tener máximo 128 caracteres.")
  .regex(/\p{L}/u, "Tu contraseña debe incluir al menos una letra.")
  .regex(/\d/, "Tu contraseña debe incluir al menos un número.");

const avatarUrlSchema = requiredText("Elige un avatar.")
  .max(2048, "La dirección del avatar es demasiado larga.")
  .pipe(
    z.url({
      protocol: /^https$/,
      error: "El avatar debe ser una dirección web que empiece por https://."
    })
  );

const bodyError = { error: "Envía los datos en formato JSON." };

// US-01 · Registro manual
export const registerSchema = z.object(
  {
    firstName: personName("nombres"),
    lastName: personName("apellidos"),
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    avatarUrl: avatarUrlSchema
  },
  bodyError
);

// US-02 · Completar el perfil después de «Continuar con Google».
// Nombres, apellidos y avatar son opcionales: si faltan se toman de la cuenta de Google.
export const completeProfileSchema = z.object(
  {
    username: usernameSchema,
    firstName: personName("nombres").optional(),
    lastName: personName("apellidos").optional(),
    avatarUrl: avatarUrlSchema.optional()
  },
  bodyError
);

export const usernameAvailabilitySchema = z.object({
  username: usernameSchema
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
