import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Workspace } from '../types/workspaces'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Every backend success response is wrapped as { success: true, data: <payload> }.
function wrap<T>(data: T) {
  return { success: true, data }
}

const organizations: Workspace[] = [
  { id: 'org-1', name: 'Acme Corp', slug: 'acme', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'org-2', name: 'Side Project', slug: 'side', createdAt: '2024-02-01T00:00:00Z' },
]

describe('workspaces.list()', () => {
  it('sends GET /orgs and returns { organizations, activeOrgId } (envelope unwrapped)', async () => {
    server.use(
      http.get(`${BASE}/orgs`, () =>
        HttpResponse.json(wrap({ organizations, activeOrgId: 'org-1' })),
      ),
    )
    // /orgs is session-only, so listing requires session auth.
    const client = new Autoposting({ apiKey: 'test-key', authSource: 'session' })
    const result = await client.workspaces.list()
    expect(result.organizations).toHaveLength(2)
    expect(result.activeOrgId).toBe('org-1')
  })

  // #39 — under API-key auth, /orgs 401s with a bare "Unauthorized". Guard it up front
  // with actionable guidance instead of letting the request fail opaquely.
  it('rejects with actionable guidance when authSource is api-key (no network call)', async () => {
    const client = new Autoposting({ apiKey: 'test-key', authSource: 'api-key' })
    await expect(client.workspaces.list()).rejects.toThrow(/session auth/i)
    await expect(client.workspaces.list()).rejects.toThrow(/single workspace/i)
  })
})

describe('workspaces.switchWorkspace()', () => {
  it('sends PUT /orgs/active with organizationId when using session auth', async () => {
    let capturedBody: unknown = null
    server.use(
      http.put(`${BASE}/orgs/active`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap({ id: 'org-2', name: 'Side Project', slug: 'side' }))
      }),
    )
    // authSource: 'session' bypasses the API key guard
    const client = new Autoposting({ apiKey: 'test-key', authSource: 'session' })
    await client.workspaces.switchWorkspace('org-2')
    expect(capturedBody).toEqual({ organizationId: 'org-2' })
  })

  it('rejects with descriptive error when authSource is api-key', async () => {
    const client = new Autoposting({ apiKey: 'test-key', authSource: 'api-key' })
    await expect(client.workspaces.switchWorkspace('org-2')).rejects.toThrow(
      'API keys are bound to a single workspace. Use session auth to switch.',
    )
  })
})
