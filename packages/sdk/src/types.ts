export type Platform = 'x' | 'linkedin' | 'instagram' | 'threads' | 'youtube'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
