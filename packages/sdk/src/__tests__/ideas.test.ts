import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Idea, GeneratedIdea } from '../types/kb'

const BASE = 'https://app.autoposting.ai/api-proxy'

const mockIdea: Idea = {
  id: 'idea-1',
  kbId: 'kb-1',
  topic: 'AI',
  title: 'The future of AI in marketing',
  hook: 'AI is quietly eating marketing',
  angle: 'contrarian',
  targetPlatform: 'linkedin',
  viralityScore: 87,
  citations: [],
  status: 'new',
  source: 'kb',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockGeneratedIdea: GeneratedIdea = {
  id: 'idea-1',
  title: 'The future of AI in marketing',
  hook: 'AI is quietly eating marketing',
  angle: 'contrarian',
  targetPlatform: 'linkedin',
  viralityScore: 87,
  citations: [],
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Every backend success response is wrapped as { success: true, data: <payload> }.
// The SDK unwraps it, so mocks must wrap and assertions check the unwrapped payload.
function wrap<T>(data: T) {
  return { success: true, data }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('ideas.generate()', () => {
  it('sends POST /ideas/generate-topic and returns the result object (ideas in .ideas)', async () => {
    const payload = { ideas: [mockGeneratedIdea], source: 'topic', topic: 'AI' }
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/ideas/generate-topic`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(payload), { status: 200 })
      }),
    )
    const result = await makeClient().ideas.generate({ kbId: 'kb-1', topic: 'AI', count: 5 })
    expect(capturedBody).toEqual({ kbId: 'kb-1', topic: 'AI', count: 5 })
    expect(result.ideas).toEqual([mockGeneratedIdea])
    expect(result.source).toBe('topic')
    expect(result.topic).toBe('AI')
  })

  it('sends POST /ideas/generate-topic with empty body when no params provided', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/ideas/generate-topic`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap({ ideas: [mockGeneratedIdea], source: 'topic', topic: 'AI' }))
      }),
    )
    await makeClient().ideas.generate()
    expect(capturedBody).toEqual({})
  })
})

describe('ideas.list()', () => {
  it('sends GET /ideas and returns the paginated envelope (items/total/limit/offset)', async () => {
    const payload = { items: [mockIdea], total: 1, limit: 100, offset: 0 }
    server.use(http.get(`${BASE}/ideas`, () => HttpResponse.json(wrap(payload))))
    const result = await makeClient().ideas.list()
    expect(result.items).toEqual([mockIdea])
    expect(result.total).toBe(1)
    expect(result.limit).toBe(100)
    expect(result.offset).toBe(0)
  })
})

describe('ideas.enrich()', () => {
  it('sends POST /ideas/enrich with idea + platforms and returns the job id', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/ideas/enrich`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap({ jobId: 'job-1' }), { status: 202 })
      }),
    )
    const idea = { title: 'The future of AI', hook: 'AI eats marketing', angle: 'contrarian' }
    const platforms = [{ platform: 'twitter' as const }, { platform: 'linkedin' as const }]
    const result = await makeClient().ideas.enrich({ idea, platforms })
    expect(capturedBody).toEqual({ idea, platforms })
    expect(result.jobId).toBe('job-1')
  })
})

describe('ideas.remove()', () => {
  it('sends DELETE /ideas/:id', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/ideas/idea-1`, () => {
        deleteCalled = true
        return HttpResponse.json(wrap({ id: 'idea-1' }))
      }),
    )
    await makeClient().ideas.remove('idea-1')
    expect(deleteCalled).toBe(true)
  })
})
