import { Resource } from '../resource'
import type { Workspace } from '../types/workspaces'
import type { Autoposting } from '../client'

export class WorkspacesResource extends Resource {
  constructor(client: Autoposting) {
    super(client)
  }

  /**
   * GET /orgs — backend returns `{ organizations, activeOrgId }`, not a bare array.
   * This route is session-only (better-auth session); an API key receives a bare 401,
   * so guard up front with actionable guidance instead of an opaque "Unauthorized".
   */
  list(): Promise<{ organizations: Workspace[]; activeOrgId: string }> {
    if (this.client.authSource === 'api-key') {
      return Promise.reject(
        new Error(
          'Listing workspaces requires session auth. API keys are scoped to a single workspace — run `ap login` to use session auth.',
        ),
      )
    }
    return this.get<{ organizations: Workspace[]; activeOrgId: string }>('/orgs')
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
    return this.client.request<void>('PUT', '/orgs/active', { organizationId: id })
  }
}
