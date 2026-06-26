export type Platform = 'x' | 'linkedin' | 'instagram' | 'threads' | 'youtube'

/**
 * The list envelope the backend emits for paginated resources (agents, agent runs,
 * ideas, carousels): `{ items, total, limit, offset }`. NOTE: not every list is paginated
 * — posts, brands, kbs and a few others return a bare array, and clips uses its own
 * `{ clips, pagination }` shape. Use the exact return type each resource declares.
 */
export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
