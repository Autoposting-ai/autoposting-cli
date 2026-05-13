import { describe, it, expect } from 'vitest'
import { exitCodeFromError, EXIT_CODES } from '../output/exit-codes.js'

// Minimal error subclasses that mirror @autoposting.ai/sdk error hierarchy.
// These are used to verify that exitCodeFromError maps by constructor name.
class AutopostingError extends Error {
  constructor(message: string) { super(message); this.name = 'AutopostingError' }
}
class AuthenticationError extends AutopostingError {
  constructor(message = 'Unauthorized') { super(message); this.name = 'AuthenticationError' }
}
class ScopeError extends AutopostingError {
  constructor(message = 'Forbidden') { super(message); this.name = 'ScopeError' }
}
class NotFoundError extends AutopostingError {
  constructor(message = 'Not found') { super(message); this.name = 'NotFoundError' }
}
class RateLimitError extends AutopostingError {
  constructor(message = 'Rate limited') { super(message); this.name = 'RateLimitError' }
}
class ValidationError extends AutopostingError {
  constructor(message = 'Invalid') { super(message); this.name = 'ValidationError' }
}
class NetworkError extends AutopostingError {
  constructor(message = 'Network failure') { super(message); this.name = 'NetworkError' }
}

describe('exitCodeFromError', () => {
  it('returns AUTH_ERROR for AuthenticationError', () => {
    expect(exitCodeFromError(new AuthenticationError())).toBe(EXIT_CODES.AUTH_ERROR)
  })

  it('returns SCOPE_ERROR for ScopeError', () => {
    expect(exitCodeFromError(new ScopeError())).toBe(EXIT_CODES.SCOPE_ERROR)
  })

  it('returns NOT_FOUND for NotFoundError', () => {
    expect(exitCodeFromError(new NotFoundError())).toBe(EXIT_CODES.NOT_FOUND)
  })

  it('returns RATE_LIMITED for RateLimitError', () => {
    expect(exitCodeFromError(new RateLimitError())).toBe(EXIT_CODES.RATE_LIMITED)
  })

  it('returns VALIDATION_ERROR for ValidationError', () => {
    expect(exitCodeFromError(new ValidationError())).toBe(EXIT_CODES.VALIDATION_ERROR)
  })

  it('returns NETWORK_ERROR for NetworkError', () => {
    expect(exitCodeFromError(new NetworkError())).toBe(EXIT_CODES.NETWORK_ERROR)
  })

  it('returns GENERAL_ERROR for unknown Error', () => {
    expect(exitCodeFromError(new Error('unknown'))).toBe(EXIT_CODES.GENERAL_ERROR)
  })

  it('returns GENERAL_ERROR for plain string', () => {
    expect(exitCodeFromError('something went wrong')).toBe(EXIT_CODES.GENERAL_ERROR)
  })

  it('returns GENERAL_ERROR for null', () => {
    expect(exitCodeFromError(null)).toBe(EXIT_CODES.GENERAL_ERROR)
  })
})
