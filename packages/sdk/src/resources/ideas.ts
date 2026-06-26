import { Resource } from '../resource'
import type { Paginated } from '../types'
import type { Idea, GenerateIdeasParams, GenerateIdeasResult, EnrichIdeaParams } from '../types/kb'

export class IdeasResource extends Resource {
  /** POST /ideas/generate-topic — returns an object whose `ideas` holds the generated ideas. */
  generate(params: GenerateIdeasParams = {}): Promise<GenerateIdeasResult> {
    return this.post<GenerateIdeasResult>('/ideas/generate-topic', params)
  }

  /** GET /ideas — backend paginates: `{ items, total, limit, offset }`. */
  list(): Promise<Paginated<Idea>> {
    return this.get<Paginated<Idea>>('/ideas')
  }

  /**
   * POST /ideas/enrich — enrich an idea (title/hook/angle) across 1..5 platforms.
   * Async: returns a job id (202). NOTE: the backend enriches the idea *object*, not an
   * id — there is no enrich-by-id route. Poll the result separately (not yet wrapped).
   */
  enrich(params: EnrichIdeaParams): Promise<{ jobId: string }> {
    return this.post<{ jobId: string }>('/ideas/enrich', params)
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/ideas/${id}`)
  }
}
