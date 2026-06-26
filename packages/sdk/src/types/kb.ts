export interface KnowledgeBase {
  id: string
  name: string
  docCount?: number
  createdAt: string
  updatedAt: string
}

export interface KbDocument {
  id: string
  kbId: string
  name: string
  type: string
  status: 'processing' | 'ready' | 'failed'
  createdAt: string
}

export interface CreateKbParams {
  name: string
}

/**
 * A single KB search hit (POST /kbs/:id/search). `score` and `uri` are null for
 * hits the backend can't rank or address; `matchReason` is only set for resource hits.
 */
export interface SearchResult {
  kind: 'resource' | 'memory'
  uri: string | null
  score: number | null
  content: string
  matchReason: string | null
}

/** A citation attached to a generated/enriched idea. */
export interface Citation {
  snippet: string
  docId?: string
  uri?: string
}

/**
 * Platform vocabulary for the ideas/enrichment domain. NOTE: this is `'twitter'`,
 * NOT the posts domain's `'x'` — the two surfaces use different platform names.
 */
export type IdeaPlatform = 'twitter' | 'linkedin' | 'instagram' | 'youtube' | 'threads'

/** A stored idea as returned by GET /ideas (list-ideas `toIdeaDto`). */
export interface Idea {
  id: string
  kbId?: string
  kbName?: string
  topic: string
  title: string
  hook: string
  angle: string
  targetPlatform: IdeaPlatform | 'any'
  viralityScore: number
  citations: Citation[]
  reasoning?: string
  status: string
  source: string
  usedAt?: string
  usedPostId?: string
  createdAt: string
  updatedAt: string
}

export interface GenerateIdeasParams {
  kbId?: string
  topic?: string
  count?: number
}

/** A freshly generated idea as returned by POST /ideas/generate-topic (agents-service shape). */
export interface GeneratedIdea {
  id?: string
  title: string
  hook: string
  angle: string
  targetPlatform: IdeaPlatform | 'any'
  viralityScore: number
  citations: Citation[]
  reasoning?: string
}

/**
 * The object returned by POST /ideas/generate-topic. The generated ideas live in `ideas`;
 * `degraded` flags a deterministic fallback and `creditsRestored` flags a refund.
 */
export interface GenerateIdeasResult {
  success?: boolean
  ideas?: GeneratedIdea[]
  degraded?: boolean
  creditsRestored?: boolean
  source: string
  topic: string
}

/** One platform target for an enrichment request. mode/targetLength/threadCount are optional tuning. */
export interface EnrichPlatform {
  platform: IdeaPlatform
  mode?: 'short' | 'premium' | 'thread' | 'standard' | 'video'
  targetLength?: number
  threadCount?: number
}

/**
 * Body for POST /ideas/enrich. The backend enriches an idea object (NOT an id) across
 * 1..5 platforms and returns a job id (202). `kbId` adds knowledge-base context.
 */
export interface EnrichIdeaParams {
  idea: { title: string; hook: string; angle: string; reasoning?: string; citations?: Citation[] }
  platforms: EnrichPlatform[]
  kbId?: string
}
