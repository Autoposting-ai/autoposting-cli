import type { Platform } from '../types'

export interface Brand {
  id: string
  slug: string
  name: string
  timezone: string
  platforms: PlatformConnection[]
  createdAt: string
  updatedAt: string
}

export interface PlatformConnection {
  platform: Platform
  connected: boolean
  // Backend field names (proven against GET /brands/:slug/auth/status).
  platformUsername?: string
  platformUserId?: string
  platformAccountType?: 'personal' | 'organization'
  profileImageUrl?: string
  expiresAt?: string
  refreshError?: string
}

export interface CreateBrandParams {
  name: string
  timezone?: string
}

export interface UpdateBrandParams {
  name?: string
  timezone?: string
}
