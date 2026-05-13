import { Resource } from '../resource'
import type { Clip, ImportClipParams } from '../types/clips'

export class ClipsResource extends Resource {
  list(): Promise<Clip[]> {
    return this.client.request<Clip[]>('GET', '/clips')
  }

  retrieve(id: string): Promise<Clip> {
    return this.client.request<Clip>('GET', `/clips/${id}`)
  }

  async upload(
    filePath: string,
    options?: { name?: string; onProgress?: (pct: number) => void },
  ): Promise<Clip> {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const data = fs.readFileSync(filePath)
    const name = options?.name ?? path.basename(filePath)

    const formData = new FormData()
    formData.append('file', new Blob([data]), name)
    formData.append('name', name)

    // onProgress not supported in single-request upload — signal start/end only
    options?.onProgress?.(0)
    const clip = await this.client.request<Clip>('POST', '/clips/upload', formData)
    options?.onProgress?.(100)
    return clip
  }

  importUrl(params: ImportClipParams): Promise<Clip> {
    return this.client.request<Clip>('POST', '/clips/import', params)
  }

  render(id: string): Promise<Clip> {
    return this.client.request<Clip>('POST', `/clips/${id}/render`)
  }

  remove(id: string): Promise<void> {
    return this.client.request<void>('DELETE', `/clips/${id}`)
  }
}
