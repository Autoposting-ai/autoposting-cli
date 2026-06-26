import { Resource } from '../resource'

export interface MediaUpload {
  data: Uint8Array<ArrayBuffer> | Blob
  filename: string
  contentType?: string
}

export interface UploadedMedia {
  url: string
  type: 'image' | 'video' | 'gif'
  filename: string
}

export class MediaResource extends Resource {
  /** POST /media/upload — multipart/form-data, ≤20MB, image/* | video/*. */
  upload(file: MediaUpload): Promise<UploadedMedia> {
    const form = new FormData()
    const blob =
      file.data instanceof Blob
        ? file.data
        : new Blob([file.data], { type: file.contentType })
    form.append('file', blob, file.filename)
    return this.client.request<UploadedMedia>('POST', '/media/upload', form)
  }
}
