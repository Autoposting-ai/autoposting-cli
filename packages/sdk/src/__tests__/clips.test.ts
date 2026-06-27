import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Autoposting } from '../client'
import { AutopostingError } from '../errors'
import type { Clip } from '../types/clips'

const BASE = 'https://app.autoposting.ai/api-proxy'
const R2 = 'https://r2.example.test'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

/** Write a temp video file of `size` bytes; the temp dir is tracked for afterEach cleanup. */
const tmpDirs: string[] = []
function tmpVideo(size: number, name = 'clip.mp4'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-sdk-upload-'))
  const file = path.join(dir, name)
  fs.writeFileSync(file, Buffer.alloc(size, 1))
  tmpDirs.push(dir)
  return file
}
afterEach(() => {
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true })
})

/** Register the full multipart upload happy path; returns captured request bodies + part PUTs. */
function mockUploadFlow(opts: { clipId?: string; uploadId?: string; key?: string } = {}) {
  const clipId = opts.clipId ?? 'clip-up-1'
  const uploadId = opts.uploadId ?? 'upload-1'
  const key = opts.key ?? `clips/org-1/${clipId}/clip.mp4`
  const captured: {
    init?: Record<string, unknown>
    presign?: Record<string, unknown>
    complete?: { parts: { partNumber: number; etag: string }[] } & Record<string, unknown>
    puts: { url: string; bytes: number }[]
    abort?: Record<string, unknown>
  } = { puts: [] }

  server.use(
    http.post(`${BASE}/clips/upload/init`, async ({ request }) => {
      captured.init = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(wrap({ clipId, uploadId, key }), { status: 201 })
    }),
    http.post(`${BASE}/clips/upload/presign`, async ({ request }) => {
      const body = (await request.json()) as { partNumbers: number[] }
      captured.presign = body as unknown as Record<string, unknown>
      const presignedUrls = body.partNumbers.map((partNumber) => ({
        partNumber,
        url: `${R2}/upload?part=${partNumber}`,
      }))
      return HttpResponse.json(wrap({ presignedUrls }))
    }),
    http.put(`${R2}/upload`, async ({ request }) => {
      const u = new URL(request.url)
      const part = u.searchParams.get('part')
      const body = await request.arrayBuffer()
      captured.puts.push({ url: request.url, bytes: body.byteLength })
      return new HttpResponse(null, { headers: { ETag: `"etag-${part}"` } })
    }),
    http.post(`${BASE}/clips/upload/complete`, async ({ request }) => {
      captured.complete = (await request.json()) as typeof captured.complete
      return HttpResponse.json(wrap({ clipId, status: 'processing' }))
    }),
    http.post(`${BASE}/clips/upload/abort`, async ({ request }) => {
      captured.abort = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(wrap({ aborted: true }))
    }),
    http.get(`${BASE}/clips/${clipId}`, () =>
      HttpResponse.json(wrap(makeClip({ id: clipId, status: 'processing' }))),
    ),
  )
  return { clipId, uploadId, key, captured }
}

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

  it('upload() drives init → presign → PUT → complete and returns the clip', async () => {
    const { clipId, uploadId, key, captured } = mockUploadFlow()
    const file = tmpVideo(1024, 'my-video.mp4')

    const progress: number[] = []
    const clip = await makeClient().clips.upload(file, {
      brandId: 'brand-1',
      title: 'Launch teaser',
      onProgress: (pct) => progress.push(pct),
    })

    expect(captured.init).toEqual({
      brandId: 'brand-1',
      title: 'Launch teaser',
      fileName: 'my-video.mp4',
      fileSize: 1024,
      mimeType: 'video/mp4',
    })
    expect(captured.presign).toMatchObject({ clipId, uploadId, key, partNumbers: [1] })
    expect(captured.puts).toHaveLength(1)
    expect(captured.puts[0].bytes).toBe(1024)
    expect(captured.complete).toMatchObject({
      clipId,
      uploadId,
      key,
      parts: [{ partNumber: 1, etag: '"etag-1"' }],
    })
    expect(clip.id).toBe(clipId)
    expect(progress[progress.length - 1]).toBe(100)
  })

  it('upload() defaults the title to the file name and infers mime from extension', async () => {
    const { captured } = mockUploadFlow()
    const file = tmpVideo(512, 'demo.mov')

    await makeClient().clips.upload(file, { brandId: 'brand-1' })

    expect(captured.init).toMatchObject({ title: 'demo.mov', mimeType: 'video/quicktime' })
  })

  it('upload() splits large files into multiple ordered parts', async () => {
    const { captured } = mockUploadFlow()
    const file = tmpVideo(11 * 1024 * 1024) // 11MB

    await makeClient().clips.upload(file, { brandId: 'brand-1', partSize: 6 * 1024 * 1024 })

    expect(captured.presign).toMatchObject({ partNumbers: [1, 2] })
    expect(captured.puts).toHaveLength(2)
    expect(captured.complete?.parts).toEqual([
      { partNumber: 1, etag: '"etag-1"' },
      { partNumber: 2, etag: '"etag-2"' },
    ])
  })

  it('upload() requires a brandId', async () => {
    const file = tmpVideo(16)
    await expect(makeClient().clips.upload(file, { brandId: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('upload() aborts the multipart upload when a part fails', async () => {
    const { uploadId, key, clipId, captured } = mockUploadFlow()
    // Override the part PUT to fail.
    server.use(http.put(`${R2}/upload`, () => new HttpResponse(null, { status: 500 })))
    const file = tmpVideo(1024)

    await expect(makeClient().clips.upload(file, { brandId: 'brand-1' })).rejects.toThrow(
      AutopostingError,
    )
    expect(captured.abort).toEqual({ clipId, uploadId, key })
  })
})
