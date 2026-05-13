export type ClipStatus = 'uploading' | 'processing' | 'ready' | 'rendering' | 'rendered' | 'failed'

export interface Clip {
  id: string
  name: string
  status: ClipStatus
  duration?: number
  url?: string
  renderedUrl?: string
  createdAt: string
  updatedAt: string
}

export interface ImportClipParams {
  url: string
  name?: string
}
