export { Autoposting, type AutopostingConfig } from './client'
export { AgentsResource } from './resources/agents'
export type { Agent, AgentRun, CreateAgentParams, UpdateAgentParams } from './types/agents'
export { BillingResource } from './resources/billing'
export type { BillingStatus, CreditBalance } from './types/billing'
export { BrandsResource } from './resources/brands'
export type { Brand, CreateBrandParams, UpdateBrandParams, PlatformConnection } from './types/brands'
export { CarouselsResource } from './resources/carousels'
export type { Carousel, CarouselSlide, CreateCarouselParams, GenerateCarouselParams } from './types/carousels'
export { ClipsResource } from './resources/clips'
export type { Clip, ClipStatus, ImportClipParams } from './types/clips'
export { PostsResource } from './resources/posts'
export type { Post, CreatePostParams, UpdatePostParams, ListPostsParams, MediaItem } from './types/posts'
export { KbResource } from './resources/kb'
export { IdeasResource } from './resources/ideas'
export { UsageResource } from './resources/usage'
export type { UsageSummary } from './types/usage'
export { WebhooksResource } from './resources/webhooks'
export type { Webhook, CreateWebhookParams, UpdateWebhookParams } from './types/webhooks'
export { WorkspacesResource } from './resources/workspaces'
export type { Workspace } from './types/workspaces'
export type {
  KnowledgeBase,
  KbDocument,
  CreateKbParams,
  SearchResult,
  Idea,
  GenerateIdeasParams,
} from './types/kb'
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
