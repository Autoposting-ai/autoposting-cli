import { VERSION } from './version'
import type { ApiResponse } from './types'
import { createError, RateLimitError, AutopostingError } from './errors'
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
  /** Max automatic retries for idempotent requests on transient failures. Default 2. */
  maxRetries?: number
  /** Base backoff in ms for retries (exponential ×2 per attempt, plus jitter). Default 300. */
  retryBaseMs?: number
}

/** Server-resolved identity behind a credential (GET /auth/profile). */
export interface AuthProfile {
  id: string
  orgId: string
  name: string
  email: string
  authType: 'api_key' | 'session'
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

// Only idempotent methods are safe to retry — retrying a POST/PATCH could double-create.
const IDEMPOTENT_METHODS: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['GET', 'PUT', 'DELETE'])
// HTTP statuses that represent a transient server/proxy condition worth retrying.
// 429 is intentionally excluded: it carries Retry-After and is surfaced to the caller
// (auto-retrying it could hang for the full Retry-After window).
const RETRYABLE_STATUS: ReadonlySet<number> = new Set([500, 502, 503, 504])

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export class Autoposting {
  /** @internal Not part of the public API — use SDK methods to make requests. */
  private readonly _apiKey: string
  readonly baseUrl: string
  readonly timeout: number
  private readonly extraHeaders: Record<string, string>
  /** Indicates how the client was authenticated; used by WorkspacesResource. */
  readonly authSource: 'api-key' | 'session'
  readonly maxRetries: number
  private readonly retryBaseMs: number
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
    // Resolution order: explicit config → AUTOPOSTING_BASE_URL env → default.
    // Production API is served by the backend behind the Next.js frontend's
    // /api-proxy rewrite (app.autoposting.ai/api-proxy/* -> backend/*). The bare
    // app.autoposting.ai host serves the dashboard SPA, not the JSON API.
    this.baseUrl = (
      config.baseUrl ||
      process.env.AUTOPOSTING_BASE_URL ||
      'https://app.autoposting.ai/api-proxy'
    ).replace(/\/$/, '')
    this.timeout = config.timeout ?? 30_000
    this.extraHeaders = config.headers ?? {}
    this.authSource = config.authSource ?? 'api-key'
    this.maxRetries = Math.max(0, config.maxRetries ?? 2)
    this.retryBaseMs = Math.max(0, config.retryBaseMs ?? 300)
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

  /**
   * GET /auth/profile — resolve the server-side identity behind the current credential.
   * Validates the key (401 on reject) and returns who/what it's scoped to.
   */
  getProfile(): Promise<AuthProfile> {
    return this.request<AuthProfile>('GET', '/auth/profile')
  }

  /**
   * Public entry point. Retries idempotent requests (GET/PUT/DELETE) on transient
   * failures — network errors, timeouts, and 5xx — with exponential backoff + jitter.
   * Non-idempotent methods (POST/PATCH) are never retried, to avoid duplicate side effects.
   */
  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    query?: Record<string, unknown>,
  ): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff (base × 2^(attempt-1)) plus jitter to avoid thundering herds.
        const backoff = this.retryBaseMs * 2 ** (attempt - 1)
        await sleep(backoff + Math.floor(Math.random() * this.retryBaseMs))
      }
      try {
        return await this._send<T>(method, path, body, query)
      } catch (err) {
        lastErr = err
        if (attempt < this.maxRetries && this.isRetryable(method, err)) continue
        throw err
      }
    }
    throw lastErr
  }

  private isRetryable(method: HttpMethod, err: unknown): boolean {
    if (!IDEMPOTENT_METHODS.has(method)) return false
    if (!(err instanceof AutopostingError)) return false
    if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT') return true
    return RETRYABLE_STATUS.has(err.status)
  }

  private async _send<T = unknown>(
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

    // FormData must not have a content-type header — fetch sets it with the multipart boundary.
    const isFormData = body instanceof FormData
    // Spread caller headers first so the auth, source, and content-type headers below
    // always win — a stray `headers` override must never strip authentication.
    const headers: Record<string, string> = {
      ...this.extraHeaders,
      authorization: `Bearer ${this._apiKey}`,
      'user-agent': `autoposting-sdk/${VERSION}`,
      'x-source': 'sdk',
    }
    if (!isFormData) {
      headers['content-type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    // Keep the abort timer armed through the body read, not just the fetch — a
    // response whose body stream stalls would otherwise hang past the timeout.
    try {
      let response: Response
      try {
        response = await fetch(url, {
          method,
          headers,
          body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })
      } catch (err) {
        // fetch rejects on network failure or abort (timeout) — wrap both so callers
        // always get an AutopostingError, never a raw TypeError / DOMException.
        if (err instanceof Error && err.name === 'AbortError') {
          throw new AutopostingError(
            `Request to ${method} ${path} timed out after ${this.timeout}ms.`,
            0,
            'TIMEOUT',
          )
        }
        throw new AutopostingError(
          `Network request to ${method} ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
          0,
          'NETWORK_ERROR',
        )
      }

      if (!response.ok) {
        const raw = await response.text()
        let errorBody: { error?: string; code?: string } = {}
        if (raw) {
          try {
            errorBody = JSON.parse(raw) as { error?: string; code?: string }
          } catch {
            // non-JSON error body (e.g. an HTML page from a wrong base URL or a proxy/5xx)
          }
        }
        if (!errorBody.error) {
          const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 120)
          errorBody.error = snippet
            ? `HTTP ${response.status} ${response.statusText}: ${snippet}`
            : `HTTP ${response.status} ${response.statusText}`
        }

        const err = createError(response.status, errorBody)

        if (err instanceof RateLimitError) {
          const retryAfter = response.headers.get('Retry-After')
          if (retryAfter) {
            // Retry-After is delta-seconds OR an HTTP-date (RFC 7231) — handle both.
            const seconds = Number(retryAfter)
            if (Number.isFinite(seconds)) {
              err.retryAfter = Math.max(0, Math.round(seconds))
            } else {
              const dateMs = Date.parse(retryAfter)
              if (!Number.isNaN(dateMs)) {
                err.retryAfter = Math.max(0, Math.round((dateMs - Date.now()) / 1000))
              }
            }
          }
        }

        throw err
      }

      // 204 No Content — return empty object
      if (response.status === 204) {
        return {} as T
      }

      const text = await response.text()
      if (!text) return {} as T
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        // A 2xx with a non-JSON body almost always means the base URL points at the
        // web app (HTML) instead of the JSON API — surface that, not a raw parse error.
        throw new AutopostingError(
          `Expected a JSON response from ${method} ${path} but received non-JSON (HTTP ${response.status}). ` +
            `Verify the API base URL (AUTOPOSTING_BASE_URL / --base-url) points at the API, not the web app.`,
          response.status,
          'INVALID_RESPONSE',
        )
      }
      // The backend wraps every success response as `{ success: true, data: <payload> }`.
      // Unwrap to the payload so resource return types describe the real data, not the
      // envelope. Void endpoints (e.g. some deletes) return `{ success: true }` with no
      // `data` — yield `{}` for those. A body without `success` passes through unchanged.
      // ponytail: relies on no real payload carrying its own top-level `success` field —
      // true for this API; revisit if an endpoint returns raw `{ success, ... }` data.
      if (typeof parsed === 'object' && parsed !== null && (parsed as ApiResponse).success === true) {
        const env = parsed as ApiResponse<T>
        return env.data !== undefined ? env.data : ({} as T)
      }
      return parsed as T
    } catch (err) {
      // A timer abort during the body read surfaces here as a raw AbortError (the
      // fetch-phase abort is already wrapped above). Convert it to TIMEOUT so callers
      // never receive a raw DOMException; already-wrapped AutopostingErrors pass through.
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AutopostingError(
          `Request to ${method} ${path} timed out after ${this.timeout}ms.`,
          0,
          'TIMEOUT',
        )
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}
