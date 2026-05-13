import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Idea } from '../types/kb'

const BASE = 'https://api.autoposting.ai'

const mockIdea: Idea = {
  id: 'idea-1',
  text: 'Write about the future of AI in marketing',
  topic: 'AI',
  kbId: 'kb-1',
  enriched: false,
  createdAt: '2024-01-01T00:00:00Z',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('ideas.generate()', () => {
  it('sends POST /ideas/generate with params and returns ideas', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/ideas/generate`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([mockIdea], { status: 201 })
      }),
    )
    const result = await makeClient().ideas.generate({ kbId: 'kb-1', topic: 'AI', count: 5 })
    expect(capturedBody).toEqual({ kbId: 'kb-1', topic: 'AI', count: 5 })
    expect(result).toEqual([mockIdea])
  })

  it('sends POST /ideas/generate with empty body when no params provided', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/ideas/generate`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json([mockIdea])
      }),
    )
    await makeClient().ideas.generate()
    expect(capturedBody).toEqual({})
  })
})

describe('ideas.list()', () => {
  it('sends GET /ideas and returns array', async () => {
    server.use(http.get(`${BASE}/ideas`, () => HttpResponse.json([mockIdea])))
    const result = await makeClient().ideas.list()
    expect(result).toEqual([mockIdea])
  })
})

describe('ideas.enrich()', () => {
  it('sends POST /ideas/:id/enrich and returns enriched idea', async () => {
    const enriched = { ...mockIdea, enriched: true }
    server.use(
      http.post(`${BASE}/ideas/idea-1/enrich`, () => HttpResponse.json(enriched)),
    )
    const result = await makeClient().ideas.enrich('idea-1')
    expect(result.enriched).toBe(true)
  })
})

describe('ideas.remove()', () => {
  it('sends DELETE /ideas/:id', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/ideas/idea-1`, () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await makeClient().ideas.remove('idea-1')
    expect(deleteCalled).toBe(true)
  })
})
