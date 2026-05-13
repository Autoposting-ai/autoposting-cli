import { describe, it, expect } from 'vitest'
import {
  AutopostingError,
  AuthenticationError,
  ScopeError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  createError,
} from '../errors'

describe('Error classes', () => {
  it('AutopostingError has correct status, code, message', () => {
    const err = new AutopostingError('test error', 500, 'INTERNAL')
    expect(err.message).toBe('test error')
    expect(err.status).toBe(500)
    expect(err.code).toBe('INTERNAL')
    expect(err).toBeInstanceOf(Error)
  })

  it('AuthenticationError is instanceof AutopostingError', () => {
    const err = new AuthenticationError('Unauthorized', 401, 'UNAUTHORIZED')
    expect(err).toBeInstanceOf(AutopostingError)
    expect(err).toBeInstanceOf(AuthenticationError)
    expect(err.status).toBe(401)
  })

  it('ScopeError is instanceof AutopostingError', () => {
    const err = new ScopeError('Forbidden', 403, 'FORBIDDEN')
    expect(err).toBeInstanceOf(AutopostingError)
    expect(err.status).toBe(403)
  })

  it('NotFoundError is instanceof AutopostingError', () => {
    const err = new NotFoundError('Not found', 404, 'NOT_FOUND')
    expect(err).toBeInstanceOf(AutopostingError)
    expect(err.status).toBe(404)
  })

  it('ValidationError is instanceof AutopostingError', () => {
    const err = new ValidationError('Invalid', 422, 'VALIDATION_ERROR')
    expect(err).toBeInstanceOf(AutopostingError)
    expect(err.status).toBe(422)
  })

  it('RateLimitError has optional retryAfter', () => {
    const err = new RateLimitError('Rate limited', 429, 'RATE_LIMITED')
    err.retryAfter = 60
    expect(err).toBeInstanceOf(AutopostingError)
    expect(err.retryAfter).toBe(60)
  })

  it('ServerError is instanceof AutopostingError', () => {
    const err = new ServerError('Server error', 500, 'INTERNAL_ERROR')
    expect(err).toBeInstanceOf(AutopostingError)
    expect(err.status).toBe(500)
  })
})

describe('createError factory', () => {
  it('maps 401 to AuthenticationError', () => {
    const err = createError(401, { error: 'Unauthorized', code: 'UNAUTHORIZED' })
    expect(err).toBeInstanceOf(AuthenticationError)
    expect(err.status).toBe(401)
  })

  it('maps 403 to ScopeError', () => {
    const err = createError(403, { error: 'Forbidden', code: 'FORBIDDEN' })
    expect(err).toBeInstanceOf(ScopeError)
  })

  it('maps 404 to NotFoundError', () => {
    const err = createError(404, { error: 'Not found', code: 'NOT_FOUND' })
    expect(err).toBeInstanceOf(NotFoundError)
  })

  it('maps 400 to ValidationError', () => {
    const err = createError(400, { error: 'Bad request', code: 'BAD_REQUEST' })
    expect(err).toBeInstanceOf(ValidationError)
  })

  it('maps 422 to ValidationError', () => {
    const err = createError(422, { error: 'Unprocessable', code: 'UNPROCESSABLE' })
    expect(err).toBeInstanceOf(ValidationError)
  })

  it('maps 429 to RateLimitError', () => {
    const err = createError(429, { error: 'Too many requests', code: 'RATE_LIMITED' })
    expect(err).toBeInstanceOf(RateLimitError)
  })

  it('maps 500 to ServerError', () => {
    const err = createError(500, { error: 'Internal server error', code: 'INTERNAL' })
    expect(err).toBeInstanceOf(ServerError)
  })

  it('maps 503 to ServerError', () => {
    const err = createError(503, { error: 'Service unavailable', code: 'UNAVAILABLE' })
    expect(err).toBeInstanceOf(ServerError)
  })

  it('uses fallback message and code when body fields missing', () => {
    const err = createError(401, {})
    expect(err.message).toBeTruthy()
    expect(err.code).toBeTruthy()
  })

  it('all created errors are instanceof AutopostingError', () => {
    const statuses = [400, 401, 403, 404, 422, 429, 500]
    for (const status of statuses) {
      const err = createError(status, { error: 'test', code: 'TEST' })
      expect(err).toBeInstanceOf(AutopostingError)
    }
  })
})
