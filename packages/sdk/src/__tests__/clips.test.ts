import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Clip } from '../types/clips'

const BASE = 'https://app.autoposting.ai'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    name: 'test-clip.mp4',
    status: 'ready',
    duration: 30,
    url: 'https://cdn.example.com/clip-1.mp4',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('ClipsResource', () => {
  it('list() sends GET /clips and returns array', async () => {
    const payload = [makeClip(), makeClip({ id: 'clip-2', name: 'other.mp4' })]
    server.use(http.get(`${BASE}/clips`, () => HttpResponse.json(payload)))

    const result = await makeClient().clips.list()
    expect(result).toEqual(payload)
  })

  it('retrieve() sends GET /clips/:id', async () => {
    const clip = makeClip()
    server.use(http.get(`${BASE}/clips/clip-1`, () => HttpResponse.json(clip)))

    const result = await makeClient().clips.retrieve('clip-1')
    expect(result).toEqual(clip)
  })

  it('importUrl() sends POST /clips/import with url and name', async () => {
    let capturedBody: unknown = null
    const clip = makeClip({ status: 'processing' })
    server.use(
      http.post(`${BASE}/clips/import`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(clip, { status: 201 })
      }),
    )

    const result = await makeClient().clips.importUrl({
      url: 'https://example.com/video.mp4',
      name: 'my-clip',
    })
    expect(capturedBody).toEqual({ url: 'https://example.com/video.mp4', name: 'my-clip' })
    expect(result).toEqual(clip)
  })

  it('render() sends POST /clips/:id/render', async () => {
    const clip = makeClip({ status: 'rendering' })
    server.use(
      http.post(`${BASE}/clips/clip-1/render`, () => HttpResponse.json(clip)),
    )

    const result = await makeClient().clips.render('clip-1')
    expect(result).toEqual(clip)
    expect(result.status).toBe('rendering')
  })

  it('remove() sends DELETE /clips/:id and resolves on 204', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/clips/clip-1`, () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await makeClient().clips.remove('clip-1')
    expect(deleteCalled).toBe(true)
  })

  it('upload() sends POST /clips/upload as multipart/form-data', async () => {
    // upload() reads an actual file — we mock the endpoint and verify the request
    // has no explicit content-type header (fetch sets it with boundary for FormData)
    let contentType: string | null = null
    const clip = makeClip({ status: 'uploading' })

    server.use(
      http.post(`${BASE}/clips/upload`, ({ request }) => {
        contentType = request.headers.get('content-type')
        return HttpResponse.json(clip, { status: 201 })
      }),
    )

    // Create a temporary file via the node:fs module
    const { writeFileSync, unlinkSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const tmpFile = join(tmpdir(), 'test-upload.mp4')
    writeFileSync(tmpFile, Buffer.from('fake video data'))

    try {
      const result = await makeClient().clips.upload(tmpFile, { name: 'test-upload.mp4' })
      expect(result).toEqual(clip)
      // fetch sets multipart/form-data boundary automatically — content-type must contain it
      expect(contentType).toMatch(/multipart\/form-data/)
    } finally {
      unlinkSync(tmpFile)
    }
  })
})
