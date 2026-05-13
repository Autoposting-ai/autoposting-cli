export { Autoposting, type AutopostingConfig } from './client'
export { BrandsResource } from './resources/brands'
export type { Brand, CreateBrandParams, UpdateBrandParams, PlatformConnection } from './types/brands'
export { PostsResource } from './resources/posts'
export type { Post, CreatePostParams, UpdatePostParams, ListPostsParams, MediaItem } from './types/posts'
export {
  AutopostingError,
  AuthenticationError,
  ScopeError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
} from './errors'
export { Resource } from './resource'
export type { Platform, PaginatedResponse, ApiResponse } from './types'
export { VERSION } from './version'
