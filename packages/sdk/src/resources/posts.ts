import { Resource } from '../resource'
import type { Post, CreatePostParams, UpdatePostParams, ListPostsParams } from '../types/posts'

// PostsResource methods `get` and `delete` cannot directly override the base class
// protected generics (`get<T>`, `delete<T>`) due to TypeScript generic covariance rules.
// We call `this.client.request` directly and expose public methods with unambiguous names.
// The public API surface is: list, get, create, update, delete, publish, schedule, retry, rewrite, score.
export class PostsResource extends Resource {
  /** GET /posts — backend returns a bare array (no pagination metadata). */
  list(params: ListPostsParams = {}): Promise<Post[]> {
    const { brandSlug, status, limit, page } = params
    const query: Record<string, unknown> = {}
    if (brandSlug) query.brandSlug = brandSlug
    if (status) query.status = status
    if (limit !== undefined) query.limit = limit
    // The backend paginates by `offset`, not `page` — translate so `--page` actually
    // advances results instead of being silently ignored.
    if (page !== undefined && page > 1) query.offset = (page - 1) * (limit ?? 20)
    return this.client.request<Post[]>('GET', '/posts', undefined, query)
  }

  /** GET /posts/:id */
  getById(id: string): Promise<Post> {
    return this.client.request<Post>('GET', `/posts/${id}`)
  }

  create(params: CreatePostParams): Promise<Post> {
    return this.client.request<Post>('POST', '/posts', params)
  }

  update(id: string, params: UpdatePostParams): Promise<Post> {
    return this.client.request<Post>('PUT', `/posts/${id}`, params)
  }

  /** DELETE /posts/:id */
  remove(id: string): Promise<void> {
    return this.client.request<void>('DELETE', `/posts/${id}`)
  }

  publish(id: string): Promise<Post> {
    return this.client.request<Post>('POST', `/posts/${id}/publish`)
  }

  schedule(id: string, scheduledAt: string): Promise<Post> {
    return this.client.request<Post>('PUT', `/posts/${id}/schedule`, { scheduledAt })
  }

  retry(id: string): Promise<Post> {
    return this.client.request<Post>('POST', `/posts/${id}/retry`)
  }

  rewrite(id: string): Promise<Post> {
    return this.client.request<Post>('POST', `/posts/${id}/rewrite`)
  }

  /** POST /posts/:id/score — backend returns `{ score }` only (no feedback). */
  score(id: string): Promise<{ score: number }> {
    return this.client.request<{ score: number }>('POST', `/posts/${id}/score`)
  }
}
