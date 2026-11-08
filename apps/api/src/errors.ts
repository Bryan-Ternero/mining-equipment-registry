/** Error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (message: string) => new AppError(404, 'NOT_FOUND', message);
export const invalid = (message: string, details?: unknown) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);
