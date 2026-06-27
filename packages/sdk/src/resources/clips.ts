import { Resource } from '../resource'
import { AutopostingError } from '../errors'
import type { Clip, ImportClipParams } from '../types/clips'

// R2/S3 multipart: every part except the last must be ≥5MB; at most 10,000 parts.
const MIN_PART_SIZE = 5 * 1024 * 1024
const DEFAULT_PART_SIZE = 16 * 1024 * 1024
const MAX_PARTS = 10_000

const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  m4v: 'video/x-m4v',
}

export interface UploadClipOptions {
  /** Brand the clip belongs to (required by the backend). */
  brandId: string
  /** Display title; defaults to the file name. */
  title?: string
  /** Override the detected MIME type. */
  contentType?: string
  /** Multipart chunk size in bytes (clamped to the 5MB..10k-part range). */
  partSize?: number
  /** Called after each part with overall percent uploaded (0–100). */
  onProgress?: (pct: number) => void
}

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

  /**
   * Upload a local video file as a clip by driving the backend multipart flow:
   * `init → presign → PUT each part → complete`. On any failure after init, the
   * multipart upload is aborted so it leaves no dangling clip. Returns the created clip.
   *
   * Node-only: reads the file in chunks (memory-bounded for multi-GB videos). `node:fs`
   * is imported dynamically so the rest of the SDK stays runtime-agnostic.
   */
  async upload(filePath: string, options: UploadClipOptions): Promise<Clip> {
    if (!options?.brandId) {
      throw new AutopostingError('brandId is required to upload a clip.', 0, 'VALIDATION_ERROR')
    }

    const { open, stat } = await import('node:fs/promises')
    const { basename } = await import('node:path')

    const fileName = basename(filePath)
    const title = options.title ?? fileName
    const mimeType = options.contentType ?? guessVideoMime(fileName)
    const { size: fileSize } = await stat(filePath)
    if (fileSize <= 0) {
      throw new AutopostingError(`File is empty: ${filePath}`, 0, 'VALIDATION_ERROR')
    }

    const partSize = resolvePartSize(fileSize, options.partSize)
    const partNumbers = Array.from(
      { length: Math.max(1, Math.ceil(fileSize / partSize)) },
      (_, i) => i + 1,
    )

    const { clipId, uploadId, key } = await this.client.request<{
      clipId: string
      uploadId: string
      key: string
    }>('POST', '/clips/upload/init', { brandId: options.brandId, title, fileName, fileSize, mimeType })

    let completed: { clipId: string; status: string }
    const handle = await open(filePath, 'r')
    try {
      const { presignedUrls } = await this.client.request<{
        presignedUrls: { partNumber: number; url: string }[]
      }>('POST', '/clips/upload/presign', { clipId, uploadId, key, partNumbers })
      const urlByPart = new Map(presignedUrls.map((p) => [p.partNumber, p.url]))

      // ponytail: parts upload sequentially with no per-part retry — simple and correct for a
      // CLI. Add bounded concurrency / retry here if throughput on large files matters.
      const parts: { partNumber: number; etag: string }[] = []
      let uploaded = 0
      for (const partNumber of partNumbers) {
        const url = urlByPart.get(partNumber)
        if (!url) {
          throw new AutopostingError(`Missing presigned URL for part ${partNumber}.`, 0, 'UPLOAD_FAILED')
        }
        const offset = (partNumber - 1) * partSize
        const length = Math.min(partSize, fileSize - offset)
        const buffer = Buffer.allocUnsafe(length)
        await handle.read(buffer, 0, length, offset)
        parts.push({ partNumber, etag: await putPart(url, buffer) })
        uploaded += length
        options.onProgress?.(Math.round((uploaded / fileSize) * 100))
      }

      completed = await this.client.request<{ clipId: string; status: string }>(
        'POST',
        '/clips/upload/complete',
        { clipId, uploadId, key, parts },
      )
    } catch (err) {
      // Best-effort abort so a failed upload doesn't strand a multipart upload + 'uploading' clip.
      // Only the init→presign→PUT→complete steps reach here; once complete succeeds the upload is
      // done, so a later retrieve() failure (below) must NOT trigger an abort of a good clip.
      await this.client.request('POST', '/clips/upload/abort', { clipId, uploadId, key }).catch(() => {})
      throw err
    } finally {
      await handle.close()
    }
    return this.retrieve(completed.clipId)
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

/** Pick a chunk size that respects the 5MB minimum and the 10,000-part ceiling. */
function resolvePartSize(fileSize: number, requested?: number): number {
  let size = requested && requested > 0 ? requested : DEFAULT_PART_SIZE
  if (Math.ceil(fileSize / size) > MAX_PARTS) size = Math.ceil(fileSize / MAX_PARTS)
  return Math.max(size, MIN_PART_SIZE)
}

function guessVideoMime(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return VIDEO_MIME[ext] ?? 'video/mp4'
}

/**
 * PUT one part to its presigned URL with a raw fetch — the URL is pre-authorized, so the
 * SDK's Bearer token and base URL must NOT be attached. Returns the part's ETag (kept
 * verbatim, quotes included, as CompleteMultipartUpload expects).
 */
async function putPart(url: string, body: Buffer): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, { method: 'PUT', body })
  } catch (err) {
    throw new AutopostingError(
      `Failed to upload part: ${err instanceof Error ? err.message : String(err)}`,
      0,
      'UPLOAD_FAILED',
    )
  }
  if (!res.ok) {
    throw new AutopostingError(
      `Failed to upload part: HTTP ${res.status} ${res.statusText}`,
      res.status,
      'UPLOAD_FAILED',
    )
  }
  const etag = res.headers.get('etag')
  if (!etag) {
    throw new AutopostingError('Upload part response is missing the ETag header.', res.status, 'UPLOAD_FAILED')
  }
  return etag
}
