import { Resource } from '../resource'
import type { KnowledgeBase, KbDocument, CreateKbParams, SearchResult } from '../types/kb'

export class KbResource extends Resource {
  list(): Promise<KnowledgeBase[]> {
    return this.get<KnowledgeBase[]>('/kbs')
  }

  retrieve(id: string): Promise<KnowledgeBase> {
    return this.get<KnowledgeBase>(`/kbs/${id}`)
  }

  create(params: CreateKbParams): Promise<KnowledgeBase> {
    return this.post<KnowledgeBase>('/kbs', params)
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/kbs/${id}`)
  }

  search(id: string, query: string): Promise<SearchResult[]> {
    return this.post<SearchResult[]>(`/kbs/${id}/search`, { query })
  }

  ingestUrl(id: string, url: string): Promise<KbDocument> {
    return this.post<KbDocument>(`/kbs/${id}/docs/ingest-url`, { url })
  }

  docs(id: string): Promise<KbDocument[]> {
    return this.get<KbDocument[]>(`/kbs/${id}/docs`)
  }
}
