import { Resource } from '../resource'
import type { Workspace } from '../types/workspaces'
import type { Autoposting } from '../client'

export class WorkspacesResource extends Resource {
  constructor(client: Autoposting) {
    super(client)
  }

  list(): Promise<Workspace[]> {
    return this.get<Workspace[]>('/orgs')
  }

  switchWorkspace(id: string): Promise<void> {
    // API keys are scoped to a single workspace at creation time.
    // Switching requires a session token that can act across orgs.
    if (this.client.authSource === 'api-key') {
      return Promise.reject(
        new Error(
          'API keys are bound to a single workspace. Use session auth to switch.',
        ),
      )
    }
    return this.post<void>('/orgs/set-active', { organizationId: id })
  }
}
