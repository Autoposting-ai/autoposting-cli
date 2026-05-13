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
  username?: string
  tokenExpired?: boolean
}

export interface CreateBrandParams {
  name: string
  timezone?: string
}

export interface UpdateBrandParams {
  name?: string
  timezone?: string
}
