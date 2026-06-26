import type { Platform } from '../types'

export interface Post {
  id: string
  brandSlug: string
  text: string
  platforms: Platform[]
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  scheduledAt?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
  media?: MediaItem[]
  score?: number
  source?: string
}

export interface MediaItem {
  url: string
  type: 'image' | 'video'
}

export interface MediaInput {
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
  source?: 'api' | 'mcp' | 'cli' | 'dashboard' | 'agent'
}

export interface UpdatePostParams {
  text?: string
  platforms?: Platform[]
  scheduledAt?: string
}

export interface ListPostsParams {
  brandSlug?: string
  status?: 'draft' | 'scheduled' | 'published' | 'failed'
  limit?: number
  page?: number
}
