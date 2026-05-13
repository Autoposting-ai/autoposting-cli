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

const BASE = 'https://api.autoposting.ai'

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

    const client = new Autoposting({ apiKey: 'key' })
    await expect((client as any).request('GET', '/v1/test')).rejects.toBeInstanceOf(ServerError)
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

    const client = new Autoposting({ apiKey: 'key', timeout: 50 })
    await expect((client as any).request('GET', '/v1/slow')).rejects.toThrow()
  })
})
