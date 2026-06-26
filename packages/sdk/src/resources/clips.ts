import { Resource } from '../resource'
import { AutopostingError } from '../errors'
import type { Clip, ImportClipParams } from '../types/clips'

export class ClipsResource extends Resource {
  /** GET /clips — backend returns `{ clips, pagination }`, not a bare array. */
  list(): Promise<{
    clips: Clip[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }> {
    return this.client.request('GET', '/clips')
  }

  retrieve(id: string): Promise<Clip> {
    return this.client.request<Clip>('GET', `/clips/${id}`)
  }

  // ponytail: the backend has no single-request /clips/upload; uploading a file means the
  // multipart init/presign/complete flow (upload-initiate → upload-presign → upload-complete).
  // That's too much surface for v0.3.1 — fail honestly and point at importUrl. Upgrade path:
  // implement the init/presign/complete dance here when direct upload is actually needed.
  async upload(
    _filePath: string,
    _options?: { name?: string; onProgress?: (pct: number) => void },
  ): Promise<Clip> {
    throw new AutopostingError(
      'Direct clip file upload is not supported by the API yet — use `importUrl` with a public video URL instead.',
      0,
      'NOT_IMPLEMENTED',
    )
  }

  /** POST /clips/import-url — backend returns `{ clipId }`, not a full Clip. */
  importUrl(params: ImportClipParams): Promise<{ clipId: string }> {
    return this.client.request<{ clipId: string }>('POST', '/clips/import-url', params)
  }

  /** POST /clips/:id/render — backend returns render job ids, not a Clip. */
  render(id: string): Promise<{ jobIds: string[]; activeJobIds: string[]; reusedJobIds: string[] }> {
    return this.client.request('POST', `/clips/${id}/render`)
  }

  remove(id: string): Promise<void> {
    return this.client.request<void>('DELETE', `/clips/${id}`)
  }
}
