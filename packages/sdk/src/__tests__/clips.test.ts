import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import { AutopostingError } from '../errors'
import type { Clip } from '../types/clips'

const BASE = 'https://app.autoposting.ai/api-proxy'

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

// Every backend success response is wrapped as { success: true, data: <payload> }.
// The SDK unwraps it, so mocks must wrap and assertions check the unwrapped payload.
function wrap<T>(data: T) {
  return { success: true, data }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('ClipsResource', () => {
  it('list() sends GET /clips and returns { clips, pagination } (envelope unwrapped)', async () => {
    const payload = {
      clips: [makeClip(), makeClip({ id: 'clip-2', name: 'other.mp4' })],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    }
    server.use(http.get(`${BASE}/clips`, () => HttpResponse.json(wrap(payload))))

    const result = await makeClient().clips.list()
    expect(result).toEqual(payload)
    expect(result.clips).toHaveLength(2)
    expect(result.pagination.totalPages).toBe(1)
  })

  it('retrieve() sends GET /clips/:id and returns the unwrapped clip', async () => {
    const clip = makeClip()
    server.use(http.get(`${BASE}/clips/clip-1`, () => HttpResponse.json(wrap(clip))))

    const result = await makeClient().clips.retrieve('clip-1')
    expect(result).toEqual(clip)
  })

  it('importUrl() sends POST /clips/import-url and returns { clipId }', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/clips/import-url`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap({ clipId: 'clip-1' }), { status: 201 })
      }),
    )

    const result = await makeClient().clips.importUrl({
      url: 'https://example.com/video.mp4',
      name: 'my-clip',
    })
    expect(capturedBody).toEqual({ url: 'https://example.com/video.mp4', name: 'my-clip' })
    expect(result).toEqual({ clipId: 'clip-1' })
  })

  it('render() sends POST /clips/:id/render and returns job ids', async () => {
    const payload = { jobIds: ['job-1'], activeJobIds: ['job-1'], reusedJobIds: [] as string[] }
    server.use(
      http.post(`${BASE}/clips/clip-1/render`, () => HttpResponse.json(wrap(payload))),
    )

    const result = await makeClient().clips.render('clip-1')
    expect(result).toEqual(payload)
  })

  it('remove() sends DELETE /clips/:id and resolves', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/clips/clip-1`, () => {
        deleteCalled = true
        return HttpResponse.json(wrap({ deleted: true }))
      }),
    )

    await makeClient().clips.remove('clip-1')
    expect(deleteCalled).toBe(true)
  })

  it('upload() throws NOT_IMPLEMENTED — direct file upload is not supported by the API', async () => {
    await expect(makeClient().clips.upload('/tmp/whatever.mp4')).rejects.toThrow(AutopostingError)
    await expect(makeClient().clips.upload('/tmp/whatever.mp4')).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
      status: 0,
    })
  })
})
