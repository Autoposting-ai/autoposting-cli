import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { KnowledgeBase, KbDocument, SearchResult } from '../types/kb'

const BASE = 'https://app.autoposting.ai/api-proxy'

const mockKb: KnowledgeBase = {
  id: 'kb-1',
  name: 'Marketing KB',
  docCount: 3,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
}

const mockDoc: KbDocument = {
  id: 'doc-1',
  kbId: 'kb-1',
  name: 'homepage.html',
  type: 'url',
  status: 'ready',
  createdAt: '2024-01-01T00:00:00Z',
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

describe('kb.list()', () => {
  it('sends GET /kbs and returns the bare array (envelope unwrapped)', async () => {
    server.use(http.get(`${BASE}/kbs`, () => HttpResponse.json(wrap([mockKb]))))
    const result = await makeClient().kb.list()
    expect(result).toEqual([mockKb])
  })
})

describe('kb.retrieve()', () => {
  it('sends GET /kbs/:id and returns kb', async () => {
    server.use(http.get(`${BASE}/kbs/kb-1`, () => HttpResponse.json(wrap(mockKb))))
    const result = await makeClient().kb.retrieve('kb-1')
    expect(result).toEqual(mockKb)
  })
})

describe('kb.create()', () => {
  it('sends POST /kbs with name and returns kb', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/kbs`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(mockKb), { status: 201 })
      }),
    )
    const result = await makeClient().kb.create({ name: 'Marketing KB' })
    expect(capturedBody).toEqual({ name: 'Marketing KB' })
    expect(result).toEqual(mockKb)
  })
})

describe('kb.remove()', () => {
  it('sends DELETE /kbs/:id', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/kbs/kb-1`, () => {
        deleteCalled = true
        // Backend returns `{ success: true }` with no data for a delete.
        return HttpResponse.json({ success: true })
      }),
    )
    await makeClient().kb.remove('kb-1')
    expect(deleteCalled).toBe(true)
  })
})

describe('kb.search()', () => {
  it('sends POST /kbs/:id/search with query body and returns the result object', async () => {
    const mockResults: SearchResult[] = [
      {
        kind: 'resource',
        uri: 'https://example.com/doc',
        score: 0.92,
        content: 'Sample content',
        matchReason: 'keyword',
      },
    ]
    const payload = { query: 'marketing tips', limit: 10, total: 1, results: mockResults }
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/kbs/kb-1/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(payload))
      }),
    )
    const result = await makeClient().kb.search('kb-1', 'marketing tips')
    expect(capturedBody).toEqual({ query: 'marketing tips' })
    expect(result).toEqual(payload)
    expect(result.results).toEqual(mockResults)
  })
})

describe('kb.ingestUrl()', () => {
  it('sends POST /kbs/:id/docs/ingest-url with url body and returns document', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/kbs/kb-1/docs/ingest-url`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(mockDoc), { status: 201 })
      }),
    )
    const result = await makeClient().kb.ingestUrl('kb-1', 'https://example.com')
    expect(capturedBody).toEqual({ url: 'https://example.com' })
    expect(result).toEqual(mockDoc)
  })
})

describe('kb.docs()', () => {
  it('sends GET /kbs/:id/docs and returns document list', async () => {
    server.use(
      http.get(`${BASE}/kbs/kb-1/docs`, () => HttpResponse.json(wrap([mockDoc]))),
    )
    const result = await makeClient().kb.docs('kb-1')
    expect(result).toEqual([mockDoc])
  })
})

describe('kb.list() empty', () => {
  it('returns empty array when no KBs exist', async () => {
    server.use(http.get(`${BASE}/kbs`, () => HttpResponse.json(wrap([]))))
    const result = await makeClient().kb.list()
    expect(result).toEqual([])
  })
})
