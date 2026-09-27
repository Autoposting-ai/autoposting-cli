export type ClipStatus = 'uploading' | 'processing' | 'ready' | 'rendering' | 'rendered' | 'failed'

export interface Clip {
  id: string
  name: string
  status: ClipStatus
  duration?: number
  url?: string
  renderedUrl?: string
  /** Bumps on every saved edit; render must send the current value. */
  editRevision?: number
  createdAt: string
  updatedAt: string
}

export interface ImportClipParams {
  url: string
  /** Brand the clip belongs to (required by the backend). */
  brandId: string
  title?: string
}

export interface RenderClipParams {
  /** Current clip editRevision; read from the clip when omitted. */
  editRevision?: number
  candidateId?: string
}

export interface CreateClipDraftParams {
  candidateId?: string
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5'
}
