export interface Agent {
  id: string
  name: string
  type: 'publish' | 'research'
  brandSlug?: string
  brandName?: string
  prompt: string
  frequency: 'manual' | 'daily' | 'weekly'
  time?: string
  weekday?: string
  enabled: boolean
  kbId?: string
  kbName?: string
  createdAt: string
  updatedAt: string
}

export interface AgentRun {
  id: string
  agentId: string
  status: 'running' | 'completed' | 'failed'
  output?: string
  createdAt: string
}

export interface CreateAgentParams {
  name: string
  type: 'publish' | 'research'
  brandSlug?: string
  prompt: string
  frequency: 'manual' | 'daily' | 'weekly'
  time?: string
  weekday?: string
  kbId?: string
}

export interface UpdateAgentParams {
  name?: string
  prompt?: string
  frequency?: string
  time?: string
  weekday?: string
}
