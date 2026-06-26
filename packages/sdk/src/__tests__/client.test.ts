import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import {
  AuthenticationError,
  ScopeError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
} from '../errors'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Autoposting client construction', () => {
  it('creates client with explicit apiKey', () => {
    const client = new Autoposting({ apiKey: 'test-key' })
    expect(client).toBeDefined()
  })

  it('reads AUTOPOSTING_API_KEY from env when no apiKey provided', () => {
    process.env.AUTOPOSTING_API_KEY = 'env-key'
    const client = new Autoposting()
    expect(client).toBeDefined()
    delete process.env.AUTOPOSTING_API_KEY
  })

  it('throws if no API key available', () => {
    delete process.env.AUTOPOSTING_API_KEY
    expect(() => new Autoposting()).toThrow(/API key/)
  })
})

describe('Autoposting client headers', () => {
  it('sets correct default headers (User-Agent, X-Source, Authorization)', async () => {
    let capturedHeaders: Record<string, string> = {}

    server.use(
      http.get(`${BASE}/v1/test`, ({ request }) => {
        request.headers.forEach((value, key) => {
          capturedHeaders[key] = value
        })
        return HttpResponse.json({ ok: true })
      }),
    )

    const client = new Autoposting({ apiKey: 'my-key' })
    await (client as any).request('GET', '/v1/test')

    expect(capturedHeaders['authorization']).toBe('Bearer my-key')
    expect(capturedHeaders['x-source']).toBe('sdk')
    expect(capturedHeaders['user-agent']).toMatch(/^autoposting-sdk\//)
    expect(capturedHeaders['content-type']).toBe('application/json')
  })
})

describe('Autoposting client requests', () => {
  it('makes GET request with query params', async () => {
    let capturedUrl = ''

    server.use(
      http.get(`${BASE}/v1/posts`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ data: [] })
      }),
    )

    const client = new Autoposting({ apiKey: 'key' })
    await (client as any).request('GET', '/v1/posts', undefined, { page: 1, limit: 10 })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('limit')).toBe('10')
  })

  it('makes POST request with JSON body', async () => {
    let capturedBody: unknown = null

    server.use(
      http.post(`${BASE}/v1/posts`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ id: '123' }, { status: 201 })
      }),
    )

    const client = new Autoposting({ apiKey: 'key' })
    const result = await (client as any).request('POST', '/v1/posts', { content: 'hello' })

    expect(capturedBody).toEqual({ content: 'hello' })
    expect(result).toEqual({ id: '123' })
  })
})

describe('Autoposting client error handling', () => {
  it('throws AuthenticationError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 }),
      ),
    )

    const client = new Autoposting({ apiKey: 'bad-key' })
    await expect((client as any).request('GET', '/v1/test')).rejects.toBeInstanceOf(AuthenticationError)
  })

  it('throws ScopeError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
      ),
    )

    const client = new Autoposting({ apiKey: 'key' })
    await expect((client as any).request('GET', '/v1/test')).rejects.toBeInstanceOf(ScopeError)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 }),
      ),
    )

    const client = new Autoposting({ apiKey: 'key' })
    await expect((client as any).request('GET', '/v1/test')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws RateLimitError on 429 with retryAfter', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json(
          { error: 'Too Many Requests', code: 'RATE_LIMITED' },
          { status: 429, headers: { 'Retry-After': '30' } },
        ),
      ),
    )

    const client = new Autoposting({ apiKey: 'key' })
    const err = await (client as any).request('GET', '/v1/test').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RateLimitError)
    expect((err as RateLimitError).retryAfter).toBe(30)
  })

  it('throws ValidationError on 400', async () => {
    server.use(
      http.post(`${BASE}/v1/test`, () =>
        HttpResponse.json({ error: 'Bad Request', code: 'BAD_REQUEST' }, { status: 400 }),
      ),
    )

    const client = new Autoposting({ apiKey: 'key' })
    await expect((client as any).request('POST', '/v1/test', {})).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ServerError on 500', async () => {
    server.use(
      http.get(`${BASE}/v1/test`, () =>
        HttpResponse.json({ error: 'Internal Server Error', code: 'INTERNAL' }, { status: 500 }),
      ),
    )

    const client = new Autoposting({ apiKey: 'key', maxRetries: 0 })
    await expect((client as any).request('GET', '/v1/test')).rejects.toBeInstanceOf(ServerError)
  })
})

describe('Autoposting client getProfile (#36)', () => {
  it('GETs /auth/profile and returns the unwrapped identity', async () => {
    server.use(
      http.get(`${BASE}/auth/profile`, () =>
        HttpResponse.json({
          success: true,
          data: { id: 'org-x', orgId: 'org-x', name: 'API Key', email: '', authType: 'api_key' },
        }),
      ),
    )
    const client = new Autoposting({ apiKey: 'key' })
    const profile = await client.getProfile()
    expect(profile.orgId).toBe('org-x')
    expect(profile.authType).toBe('api_key')
  })
})

describe('Autoposting client retry (#38)', () => {
  it('retries an idempotent GET on 503 then succeeds', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/flaky`, () => {
        calls++
        if (calls < 3) return HttpResponse.json({ error: 'unavailable' }, { status: 503 })
        return HttpResponse.json({ success: true, data: { ok: true } })
      }),
    )
    const client = new Autoposting({ apiKey: 'k', retryBaseMs: 1 })
    const res = await (client as any).request('GET', '/flaky')
    expect(calls).toBe(3)
    expect(res).toEqual({ ok: true })
  })

  it('retries an idempotent GET on a network error then succeeds', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/neterr`, () => {
        calls++
        if (calls < 2) return HttpResponse.error()
        return HttpResponse.json({ success: true, data: { ok: true } })
      }),
    )
    const client = new Autoposting({ apiKey: 'k', retryBaseMs: 1 })
    const res = await (client as any).request('GET', '/neterr')
    expect(calls).toBe(2)
    expect(res).toEqual({ ok: true })
  })

  it('retries DELETE (idempotent) on 503 — a transient failure must not orphan the resource', async () => {
    let calls = 0
    server.use(
      http.delete(`${BASE}/posts/1`, () => {
        calls++
        if (calls < 2) return HttpResponse.json({ error: 'unavailable' }, { status: 503 })
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const client = new Autoposting({ apiKey: 'k', retryBaseMs: 1 })
    await (client as any).request('DELETE', '/posts/1')
    expect(calls).toBe(2)
  })

  it('does NOT retry POST (non-idempotent) on 503 — avoids a double-create', async () => {
    let calls = 0
    server.use(
      http.post(`${BASE}/posts`, () => {
        calls++
        return HttpResponse.json({ error: 'unavailable' }, { status: 503 })
      }),
    )
    const client = new Autoposting({ apiKey: 'k', retryBaseMs: 1 })
    await expect((client as any).request('POST', '/posts', {})).rejects.toBeInstanceOf(ServerError)
    expect(calls).toBe(1)
  })

  it('gives up after maxRetries and throws the last error', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/down`, () => {
        calls++
        return HttpResponse.json({ error: 'down' }, { status: 503 })
      }),
    )
    const client = new Autoposting({ apiKey: 'k', retryBaseMs: 1, maxRetries: 2 })
    await expect((client as any).request('GET', '/down')).rejects.toBeInstanceOf(ServerError)
    expect(calls).toBe(3)
  })

  it('does NOT retry a 404 (not transient)', async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/missing`, () => {
        calls++
        return HttpResponse.json({ error: 'gone', code: 'NOT_FOUND' }, { status: 404 })
      }),
    )
    const client = new Autoposting({ apiKey: 'k', retryBaseMs: 1 })
    await expect((client as any).request('GET', '/missing')).rejects.toBeInstanceOf(NotFoundError)
    expect(calls).toBe(1)
  })
})

describe('Autoposting client configuration', () => {
  it('respects custom baseUrl', async () => {
    let capturedUrl = ''

    server.use(
      http.get('https://custom.example.com/v1/test', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({ ok: true })
      }),
    )

    const client = new Autoposting({ apiKey: 'key', baseUrl: 'https://custom.example.com' })
    await (client as any).request('GET', '/v1/test')

    expect(capturedUrl).toContain('custom.example.com')
  })

  it('respects timeout and aborts slow requests', async () => {
    server.use(
      http.get(`${BASE}/v1/slow`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return HttpResponse.json({ ok: true })
      }),
    )

    const client = new Autoposting({ apiKey: 'key', timeout: 50, maxRetries: 0 })
    await expect((client as any).request('GET', '/v1/slow')).rejects.toThrow()
  })
})
