import { VERSION } from './version'
import { createError, RateLimitError } from './errors'
import { AgentsResource } from './resources/agents'
import { BillingResource } from './resources/billing'
import { BrandsResource } from './resources/brands'
import { CarouselsResource } from './resources/carousels'
import { ClipsResource } from './resources/clips'
import { PostsResource } from './resources/posts'
import { KbResource } from './resources/kb'
import { IdeasResource } from './resources/ideas'
import { UsageResource } from './resources/usage'
import { WebhooksResource } from './resources/webhooks'
import { WorkspacesResource } from './resources/workspaces'

export interface AutopostingConfig {
  apiKey?: string
  baseUrl?: string
  timeout?: number
  headers?: Record<string, string>
  /** Mark the auth source so workspace-switching can enforce API key restrictions. */
  authSource?: 'api-key' | 'session'
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export class Autoposting {
  /** @internal Not part of the public API — use SDK methods to make requests. */
  private readonly _apiKey: string
  readonly baseUrl: string
  readonly timeout: number
  private readonly extraHeaders: Record<string, string>
  /** Indicates how the client was authenticated; used by WorkspacesResource. */
  readonly authSource: 'api-key' | 'session'
  readonly agents: AgentsResource
  readonly billing: BillingResource
  readonly brands: BrandsResource
  readonly carousels: CarouselsResource
  readonly clips: ClipsResource
  readonly posts: PostsResource
  readonly kb: KbResource
  readonly ideas: IdeasResource
  readonly usage: UsageResource
  readonly webhooks: WebhooksResource
  readonly workspaces: WorkspacesResource

  constructor(config: AutopostingConfig = {}) {
    const key = config.apiKey ?? process.env.AUTOPOSTING_API_KEY
    if (!key) {
      throw new Error(
        'API key is required. Pass apiKey in config or set AUTOPOSTING_API_KEY env var.',
      )
    }
    this._apiKey = key
    this.baseUrl = (config.baseUrl ?? 'https://app.autoposting.ai').replace(/\/$/, '')
    this.timeout = config.timeout ?? 30_000
    this.extraHeaders = config.headers ?? {}
    this.authSource = config.authSource ?? 'api-key'
    this.agents = new AgentsResource(this)
    this.billing = new BillingResource(this)
    this.brands = new BrandsResource(this)
    this.carousels = new CarouselsResource(this)
    this.clips = new ClipsResource(this)
    this.posts = new PostsResource(this)
    this.kb = new KbResource(this)
    this.ideas = new IdeasResource(this)
    this.usage = new UsageResource(this)
    this.webhooks = new WebhooksResource(this)
    this.workspaces = new WorkspacesResource(this)
  }

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`

    if (query && Object.keys(query).length > 0) {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          params.set(k, String(v))
        }
      }
      url = `${url}?${params.toString()}`
    }

    // FormData must not have a content-type header — fetch sets it with the multipart boundary
    const isFormData = body instanceof FormData
    const headers: Record<string, string> = {
      authorization: `Bearer ${this._apiKey}`,
      'user-agent': `autoposting-sdk/${VERSION}`,
      'x-source': 'sdk',
      ...this.extraHeaders,
    }
    if (!isFormData) {
      headers['content-type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      let errorBody: { error?: string; code?: string } = {}
      try {
        errorBody = (await response.json()) as { error?: string; code?: string }
      } catch {
        // non-JSON error body — leave as empty object
      }

      const err = createError(response.status, errorBody)

      if (err instanceof RateLimitError) {
        const retryAfter = response.headers.get('Retry-After')
        if (retryAfter) {
          err.retryAfter = parseInt(retryAfter, 10)
        }
      }

      throw err
    }

    // 204 No Content — return empty object
    if (response.status === 204) {
      return {} as T
    }

    return response.json() as Promise<T>
  }
}
