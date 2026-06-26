import { Resource } from '../resource'
import type { Post, CreatePostParams, UpdatePostParams, ListPostsParams } from '../types/posts'
import type { PaginatedResponse } from '../types'

// PostsResource methods `get` and `delete` cannot directly override the base class
// protected generics (`get<T>`, `delete<T>`) due to TypeScript generic covariance rules.
// We call `this.client.request` directly and expose public methods with unambiguous names.
// The public API surface is: list, get, create, update, delete, publish, schedule, retry, rewrite, score.
export class PostsResource extends Resource {
  list(params?: ListPostsParams): Promise<PaginatedResponse<Post>> {
    return this.client.request<PaginatedResponse<Post>>(
      'GET',
      '/posts',
      undefined,
      params as Record<string, unknown>,
    )
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

  score(id: string): Promise<{ score: number; feedback: string }> {
    return this.client.request<{ score: number; feedback: string }>(
      'POST',
      `/posts/${id}/score`,
    )
  }
}
