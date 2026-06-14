export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const BadRequest = (message: string, code?: string) => new AppError(400, message, code);
export const Unauthorized = (message = 'Unauthorized', code?: string) => new AppError(401, message, code);
export const Forbidden = (message = 'Forbidden', code?: string) => new AppError(403, message, code);
export const NotFound = (message = 'Not found', code?: string) => new AppError(404, message, code);
export const Conflict = (message: string, code?: string) => new AppError(409, message, code);
export const PayloadTooLarge = (message: string, code?: string) => new AppError(413, message, code);
export const InternalError = (message = 'Internal server error', code?: string) => new AppError(500, message, code);
