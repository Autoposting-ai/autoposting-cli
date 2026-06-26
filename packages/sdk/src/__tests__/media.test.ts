import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { UploadedMedia } from '../resources/media'

const BASE = 'https://app.autoposting.ai/api-proxy'

function wrap<T>(data: T) {
  return { success: true, data }
}

const mockUploaded: UploadedMedia = {
  url: 'https://cdn.autoposting.ai/uploads/image.png',
  type: 'image',
  filename: 'image.png',
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('MediaResource.upload()', () => {
  it('POSTs multipart/form-data to /media/upload and returns unwrapped {url,type,filename}', async () => {
    let capturedContentType = ''
    let capturedFilename = ''

    server.use(
      http.post(`${BASE}/media/upload`, async ({ request }) => {
        capturedContentType = request.headers.get('content-type') ?? ''
        // Parse the multipart body to verify the file part
        const formData = await request.formData()
        const filePart = formData.get('file')
        if (filePart instanceof File) {
          capturedFilename = filePart.name
        }
        return HttpResponse.json(wrap(mockUploaded), { status: 200 })
      }),
    )

    const client = new Autoposting({ apiKey: 'test-key' })
    const data = new Uint8Array([137, 80, 78, 71]) // PNG magic bytes
    const result = await client.media.upload({
      data,
      filename: 'image.png',
      contentType: 'image/png',
    })

    expect(capturedContentType).toMatch(/^multipart\/form-data/)
    expect(capturedFilename).toBe('image.png')
    expect(result).toEqual(mockUploaded)
  })

  it('works with a Blob input', async () => {
    server.use(
      http.post(`${BASE}/media/upload`, async ({ request }) => {
        const formData = await request.formData()
        const filePart = formData.get('file')
        expect(filePart).toBeInstanceOf(File)
        return HttpResponse.json(wrap({ url: 'https://cdn.autoposting.ai/v.mp4', type: 'video', filename: 'v.mp4' }))
      }),
    )

    const client = new Autoposting({ apiKey: 'test-key' })
    const blob = new Blob(['fake-video-data'], { type: 'video/mp4' })
    const result = await client.media.upload({ data: blob, filename: 'v.mp4', contentType: 'video/mp4' })
    expect(result.type).toBe('video')
    expect(result.filename).toBe('v.mp4')
  })
})
