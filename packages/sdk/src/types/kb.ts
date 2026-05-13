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

export interface SearchResult {
  content: string
  score: number
  docId: string
}

export interface Idea {
  id: string
  text: string
  topic?: string
  kbId?: string
  enriched?: boolean
  createdAt: string
}

export interface GenerateIdeasParams {
  kbId?: string
  topic?: string
  count?: number
}
