import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { KnowledgeBase, KbDocument, SearchResult } from '../types/kb'

const BASE = 'https://app.autoposting.ai'

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

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('kb.list()', () => {
  it('sends GET /kbs and returns array', async () => {
    server.use(http.get(`${BASE}/kbs`, () => HttpResponse.json([mockKb])))
    const result = await makeClient().kb.list()
    expect(result).toEqual([mockKb])
  })
})

describe('kb.retrieve()', () => {
  it('sends GET /kbs/:id and returns kb', async () => {
    server.use(http.get(`${BASE}/kbs/kb-1`, () => HttpResponse.json(mockKb)))
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
        return HttpResponse.json(mockKb, { status: 201 })
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
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await makeClient().kb.remove('kb-1')
    expect(deleteCalled).toBe(true)
  })
})

describe('kb.search()', () => {
  it('sends POST /kbs/:id/search with query body and returns results', async () => {
    const mockResults: SearchResult[] = [
      { content: 'Sample content', score: 0.92, docId: 'doc-1' },
    ]
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/kbs/kb-1/search`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(mockResults)
      }),
    )
    const result = await makeClient().kb.search('kb-1', 'marketing tips')
    expect(capturedBody).toEqual({ query: 'marketing tips' })
    expect(result).toEqual(mockResults)
  })
})

describe('kb.ingestUrl()', () => {
  it('sends POST /kbs/:id/docs/ingest-url with url body and returns document', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/kbs/kb-1/docs/ingest-url`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(mockDoc, { status: 201 })
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
      http.get(`${BASE}/kbs/kb-1/docs`, () => HttpResponse.json([mockDoc])),
    )
    const result = await makeClient().kb.docs('kb-1')
    expect(result).toEqual([mockDoc])
  })
})

describe('kb.list() empty', () => {
  it('returns empty array when no KBs exist', async () => {
    server.use(http.get(`${BASE}/kbs`, () => HttpResponse.json([])))
    const result = await makeClient().kb.list()
    expect(result).toEqual([])
  })
})
