import { z } from "zod";

export const userSchema = z.object({
  name: z
    .string()
    .min(2, "Name must contain at least 2 characters"),

  email: z
    .string()
    .email("Invalid email format"),

  role: z
    .enum(["student", "teacher", "admin"])
});