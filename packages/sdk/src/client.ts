import { VERSION } from './version'
import { createError, RateLimitError } from './errors'
import { BrandsResource } from './resources/brands'
import { PostsResource } from './resources/posts'

export interface AutopostingConfig {
  apiKey?: string
  baseUrl?: string
  timeout?: number
  headers?: Record<string, string>
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export class Autoposting {
  readonly apiKey: string
  readonly baseUrl: string
  readonly timeout: number
  private readonly extraHeaders: Record<string, string>
  readonly brands: BrandsResource
  readonly posts: PostsResource

  constructor(config: AutopostingConfig = {}) {
    const key = config.apiKey ?? process.env.AUTOPOSTING_API_KEY
    if (!key) {
      throw new Error(
        'API key is required. Pass apiKey in config or set AUTOPOSTING_API_KEY env var.',
      )
    }
    this.apiKey = key
    this.baseUrl = (config.baseUrl ?? 'https://api.autoposting.ai').replace(/\/$/, '')
    this.timeout = config.timeout ?? 30_000
    this.extraHeaders = config.headers ?? {}
    this.brands = new BrandsResource(this)
    this.posts = new PostsResource(this)
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

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'user-agent': `autoposting-sdk/${VERSION}`,
      'x-source': 'sdk',
      ...this.extraHeaders,
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    let response: Response
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
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
