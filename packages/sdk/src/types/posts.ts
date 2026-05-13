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

export interface CreatePostParams {
  brandSlug: string
  text: string
  platforms: Platform[]
  scheduledAt?: string
  media?: string[]
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
