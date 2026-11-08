/** Error con un status HTTP y un código estable legible por máquinas. */
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
export const unauthorized = (message = 'Inicie sesión para continuar.') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message: string) => new AppError(403, 'FORBIDDEN', message);
export const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  new AppError(429, 'TOO_MANY_REQUESTS', message, { retryAfterSeconds });
