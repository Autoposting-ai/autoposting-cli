import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Carousel } from '../types/carousels'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeCarousel(overrides: Partial<Carousel> = {}): Carousel {
  return {
    id: 'carousel-1',
    title: 'Test Carousel',
    slides: [
      { index: 0, text: 'Slide one' },
      { index: 1, text: 'Slide two', imageUrl: 'https://example.com/img.png' },
    ],
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// Every backend success response is wrapped as { success: true, data: <payload> }.
// The SDK unwraps it, so mocks must wrap and assertions check the unwrapped payload.
function wrap<T>(data: T) {
  return { success: true, data }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('carousels.list()', () => {
  it('sends GET /carousels and returns the paginated payload (envelope unwrapped)', async () => {
    const payload = { items: [makeCarousel()], total: 1, limit: 100, offset: 0 }
    server.use(http.get(`${BASE}/carousels`, () => HttpResponse.json(wrap(payload))))
    const result = await makeClient().carousels.list()
    expect(result).toEqual(payload)
  })
})

describe('carousels.retrieve()', () => {
  it('sends GET /carousels/:id and returns carousel', async () => {
    const carousel = makeCarousel({ id: 'abc-123' })
    server.use(http.get(`${BASE}/carousels/abc-123`, () => HttpResponse.json(wrap(carousel))))
    const result = await makeClient().carousels.retrieve('abc-123')
    expect(result).toEqual(carousel)
  })
})

describe('carousels.create()', () => {
  it('sends POST /carousels with title', async () => {
    let capturedBody: unknown = null
    const carousel = makeCarousel()
    server.use(
      http.post(`${BASE}/carousels`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(carousel), { status: 201 })
      }),
    )
    const result = await makeClient().carousels.create({ title: 'My Carousel' })
    expect(capturedBody).toEqual({ title: 'My Carousel' })
    expect(result).toEqual(carousel)
  })

  it('sends POST /carousels without params', async () => {
    const carousel = makeCarousel({ title: undefined })
    server.use(
      http.post(`${BASE}/carousels`, () => HttpResponse.json(wrap(carousel), { status: 201 })),
    )
    const result = await makeClient().carousels.create()
    expect(result.id).toBe('carousel-1')
  })
})

describe('carousels.generate()', () => {
  it('sends POST /carousels/generate with topic and options', async () => {
    let capturedBody: unknown = null
    const carousel = makeCarousel({ status: 'ready' })
    server.use(
      http.post(`${BASE}/carousels/generate`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(carousel))
      }),
    )
    const result = await makeClient().carousels.generate({
      topic: 'AI trends',
      brandSlug: 'my-brand',
      slideCount: 5,
    })
    expect(capturedBody).toEqual({ topic: 'AI trends', brandSlug: 'my-brand', slideCount: 5 })
    expect(result.status).toBe('ready')
  })
})

describe('carousels.draft()', () => {
  it('sends POST /carousels/:id/create-draft', async () => {
    let draftCalled = false
    const carousel = makeCarousel({ status: 'ready' })
    server.use(
      http.post(`${BASE}/carousels/carousel-1/create-draft`, () => {
        draftCalled = true
        return HttpResponse.json(wrap(carousel))
      }),
    )
    await makeClient().carousels.draft('carousel-1')
    expect(draftCalled).toBe(true)
  })
})

describe('carousels.remove()', () => {
  it('sends DELETE /carousels/:id', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/carousels/carousel-1`, () => {
        deleteCalled = true
        return HttpResponse.json(wrap({ deleted: true }))
      }),
    )
    await makeClient().carousels.remove('carousel-1')
    expect(deleteCalled).toBe(true)
  })
})
