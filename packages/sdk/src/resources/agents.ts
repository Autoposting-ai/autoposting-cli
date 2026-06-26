import { Resource } from '../resource'
import type { Paginated } from '../types'
import type { Agent, AgentRun, CreateAgentParams, UpdateAgentParams } from '../types/agents'

export class AgentsResource extends Resource {
  /** GET /agents — backend returns `{ items, total, limit, offset }`. */
  list(): Promise<Paginated<Agent>> {
    return this.get<Paginated<Agent>>('/agents')
  }

  retrieve(id: string): Promise<Agent> {
    return this.get<Agent>(`/agents/${id}`)
  }

  create(params: CreateAgentParams): Promise<Agent> {
    return this.post<Agent>('/agents', params)
  }

  update(id: string, params: UpdateAgentParams): Promise<Agent> {
    return this.patch<Agent>(`/agents/${id}`, params)
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/agents/${id}`)
  }

  /** POST /agents/:id/run — queues a run; returns `{ runId, status }`, not a full AgentRun. */
  run(id: string): Promise<{ runId: string; status: string }> {
    return this.post<{ runId: string; status: string }>(`/agents/${id}/run`)
  }

  toggle(id: string): Promise<Agent> {
    return this.post<Agent>(`/agents/${id}/toggle`)
  }

  /** GET /agents/:id/runs — backend returns `{ items, total, limit, offset }`. */
  runs(id: string): Promise<Paginated<AgentRun>> {
    return this.get<Paginated<AgentRun>>(`/agents/${id}/runs`)
  }
}
