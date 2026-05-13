export class AutopostingError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = this.constructor.name
    this.status = status
    this.code = code
    // Restore prototype chain (required for custom Error subclasses in TS)
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class AuthenticationError extends AutopostingError {}
export class ScopeError extends AutopostingError {}
export class NotFoundError extends AutopostingError {}
export class ValidationError extends AutopostingError {}

export class RateLimitError extends AutopostingError {
  retryAfter?: number
}

export class ServerError extends AutopostingError {}

export function createError(
  status: number,
  body: { error?: string; code?: string },
): AutopostingError {
  const message = body.error ?? 'An error occurred'
  const code = body.code ?? 'UNKNOWN'

  if (status === 401) return new AuthenticationError(message, status, code)
  if (status === 403) return new ScopeError(message, status, code)
  if (status === 404) return new NotFoundError(message, status, code)
  if (status === 400 || status === 422) return new ValidationError(message, status, code)
  if (status === 429) return new RateLimitError(message, status, code)
  if (status >= 500) return new ServerError(message, status, code)

  return new AutopostingError(message, status, code)
}
