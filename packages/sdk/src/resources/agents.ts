import { Resource } from '../resource'
import type { Agent, AgentRun, CreateAgentParams, UpdateAgentParams } from '../types/agents'

export class AgentsResource extends Resource {
  list(): Promise<Agent[]> {
    return this.get<Agent[]>('/agents')
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

  run(id: string): Promise<AgentRun> {
    return this.post<AgentRun>(`/agents/${id}/run`)
  }

  toggle(id: string): Promise<Agent> {
    return this.post<Agent>(`/agents/${id}/toggle`)
  }

  runs(id: string): Promise<AgentRun[]> {
    return this.get<AgentRun[]>(`/agents/${id}/runs`)
  }
}
