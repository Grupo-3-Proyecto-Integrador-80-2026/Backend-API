import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { HttpError } from "../utils/http-error";

type Source = "body" | "query" | "params";

// Valida req[source] con el esquema. El cuerpo validado reemplaza a req.body;
// query y params (de solo lectura en Express 5) quedan en res.locals.validated.
export const validate = (schema: z.ZodType, source: Source = "body") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Revisa los datos marcados e intenta de nuevo.",
        result.error.issues.map((issue) => ({
          field: issue.path.join(".") || source,
          message: issue.message
        }))
      );
    }

    if (source === "body") {
      req.body = result.data;
    } else {
      res.locals.validated = { ...res.locals.validated, [source]: result.data };
    }

    next();
  };
};
