import type { Platform } from '../types'

export interface Post {
  id: string
  brandSlug: string
  text: string
  platforms: Platform[]
  status: 'draft' | 'scheduled' | 'billing_hold' | 'render_reserving' | 'validating' | 'validated' | 'publishing' | 'published' | 'failed' | 'partial' | 'archived' | 'render_pending'
  scheduledAt?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  media?: MediaItem[]
  platformMedia?: Partial<Record<Platform, MediaInput[]>>
  platformTexts?: Partial<Record<Platform, string>>
  targetAccountIds?: Partial<Record<Platform, string[]>>
  facebookOptions?: FacebookOptions
  facebookRecoveryPageIds?: string[]
  platformResults?: Partial<Record<Platform, PlatformResult>>
  score?: number
  source?: string
}

export interface MediaItem {
  url: string
  type: 'image' | 'video' | 'gif'
  altText?: string
  sizeBytes?: number
}

export interface MediaInput {
  sizeBytes?: number
  url: string
  type: 'image' | 'video' | 'gif'
  altText?: string
}

export interface InstagramOptions {
  reel?: {
    thumbOffsetMs?: number
    shareToFeed?: boolean
    coverUrl?: string
    collaborators?: string[]
  }
}

export interface ThreadsOptions {
  replyToId?: string
  replyControl?: string
}

export interface YoutubeOptions {
  title?: string
  description?: string
  tags?: string[]
  privacyStatus?: string
  madeForKids?: boolean
  categoryId?: string
}

export interface FacebookOptions {
  format: 'text' | 'link' | 'photo' | 'multi-photo' | 'video' | 'reel'
  link?: string
}

export interface AccountResult {
  platformUserId: string
  platformUsername?: string
  profileImageUrl?: string
  status: 'pending' | 'published' | 'failed' | 'unknown'
  platformPostId?: string
  url?: string
  error?: string
  errorDetail?: Record<string, unknown>
  remoteIds?: { id: string; postId?: string }[]
  publishedAt?: string
}

export interface PlatformResult {
  status: 'pending' | 'publishing' | 'published' | 'failed' | 'partial' | 'unknown'
  accounts?: AccountResult[]
  platformPostId?: string
  platformUsername?: string
  url?: string
  error?: string
  errorDetail?: Record<string, unknown>
  publishedAt?: string
}

export interface CreatePostParams {
  brandSlug: string
  text: string
  platforms: Platform[]
  scheduledAt?: string
  /** Additional posts appended after `text` to form an X/Threads thread (max 25, x/threads only). */
  thread?: string[]
  media?: MediaInput[]
  platformMedia?: Partial<Record<Platform, MediaInput[]>>
  platformTexts?: Partial<Record<Platform, string>>
  targetAccountIds?: Partial<Record<Platform, string[]>>
  instagramOptions?: InstagramOptions
  threadsOptions?: ThreadsOptions
  youtubeOptions?: YoutubeOptions
  facebookOptions?: FacebookOptions
  source?: 'api' | 'mcp' | 'cli' | 'dashboard' | 'agent'
}

export interface UpdatePostParams {
  facebookOptions?: FacebookOptions
  platformMedia?: Partial<Record<Platform, MediaInput[]>>
  platformTexts?: Partial<Record<Platform, string>>
  targetAccountIds?: Partial<Record<Platform, string[]>>
  text?: string
  platforms?: Platform[]
  scheduledAt?: string
  media?: MediaInput[]
}

export interface ListPostsParams {
  brandSlug?: string
  status?: 'draft' | 'scheduled' | 'published' | 'failed'
  limit?: number
  page?: number
}

export interface FacebookRetryResult {
  id: string
  status: 'publishing'
  retrying: ['facebook']
  pageIds: string[]
}

export interface FacebookRecoveryScheduleResult {
  id: string
  status: 'scheduled'
  scheduledAt: string
  pageIds: string[]
}
