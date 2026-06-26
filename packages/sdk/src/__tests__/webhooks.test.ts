import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Webhook } from '../types/webhooks'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Every backend success response is wrapped as { success: true, data: <payload> }.
function wrap<T>(data: T) {
  return { success: true, data }
}

function makeWebhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id: 'webhook-1',
    url: 'https://example.com/hook',
    events: ['post.published', 'post.failed'],
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('webhooks.list()', () => {
  it('sends GET /webhooks and returns the unwrapped array', async () => {
    const payload = [makeWebhook()]
    server.use(http.get(`${BASE}/webhooks`, () => HttpResponse.json(wrap(payload))))
    const result = await makeClient().webhooks.list()
    expect(result).toEqual(payload)
  })
})

describe('webhooks.retrieve()', () => {
  it('sends GET /webhooks/:id and returns the unwrapped webhook', async () => {
    const webhook = makeWebhook({ id: 'wh-123' })
    server.use(http.get(`${BASE}/webhooks/wh-123`, () => HttpResponse.json(wrap(webhook))))
    const result = await makeClient().webhooks.retrieve('wh-123')
    expect(result).toEqual(webhook)
  })
})

describe('webhooks.create()', () => {
  it('sends POST /webhooks with url, events, and secret', async () => {
    let capturedBody: unknown = null
    const webhook = makeWebhook({ secret: 'mysecret' })
    server.use(
      http.post(`${BASE}/webhooks`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(webhook), { status: 201 })
      }),
    )
    const result = await makeClient().webhooks.create({
      url: 'https://example.com/hook',
      events: ['post.published', 'post.failed'],
      secret: 'mysecret',
    })
    expect(capturedBody).toEqual({
      url: 'https://example.com/hook',
      events: ['post.published', 'post.failed'],
      secret: 'mysecret',
    })
    expect(result).toEqual(webhook)
  })

  it('sends POST /webhooks without secret', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/webhooks`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(makeWebhook()), { status: 201 })
      }),
    )
    await makeClient().webhooks.create({
      url: 'https://example.com/hook',
      events: ['post.published'],
    })
    expect((capturedBody as { secret?: string }).secret).toBeUndefined()
  })
})

describe('webhooks.update()', () => {
  it('sends PATCH /webhooks/:id with params', async () => {
    let capturedBody: unknown = null
    const updated = makeWebhook({ active: false })
    server.use(
      http.patch(`${BASE}/webhooks/webhook-1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(updated))
      }),
    )
    const result = await makeClient().webhooks.update('webhook-1', { active: false })
    expect(capturedBody).toEqual({ active: false })
    expect(result.active).toBe(false)
  })
})

describe('webhooks.remove()', () => {
  it('sends DELETE /webhooks/:id', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/webhooks/webhook-1`, () => {
        deleteCalled = true
        return HttpResponse.json(wrap({ deleted: true }))
      }),
    )
    await makeClient().webhooks.remove('webhook-1')
    expect(deleteCalled).toBe(true)
  })
})

describe('webhooks.test()', () => {
  it('sends POST /webhooks/:id/test and returns { delivered, httpStatus }', async () => {
    server.use(
      http.post(`${BASE}/webhooks/webhook-1/test`, () =>
        HttpResponse.json(wrap({ delivered: true, httpStatus: 200 })),
      ),
    )
    const result = await makeClient().webhooks.test('webhook-1')
    expect(result.delivered).toBe(true)
    expect(result.httpStatus).toBe(200)
  })
})
