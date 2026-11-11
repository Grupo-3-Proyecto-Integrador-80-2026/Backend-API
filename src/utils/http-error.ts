export interface FieldError {
  field: string;
  message: string;
}

// Error con código HTTP, código estable para el frontend y mensaje en español listo para mostrar
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly errors?: FieldError[]
  ) {
    super(message);
    this.name = "HttpError";
  }
}
