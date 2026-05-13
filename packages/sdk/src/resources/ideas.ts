import { Resource } from '../resource'
import type { Idea, GenerateIdeasParams } from '../types/kb'

export class IdeasResource extends Resource {
  generate(params: GenerateIdeasParams = {}): Promise<Idea[]> {
    return this.post<Idea[]>('/ideas/generate', params)
  }

  list(): Promise<Idea[]> {
    return this.get<Idea[]>('/ideas')
  }

  enrich(id: string): Promise<Idea> {
    return this.post<Idea>(`/ideas/${id}/enrich`)
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/ideas/${id}`)
  }
}
