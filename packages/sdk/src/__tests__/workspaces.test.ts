import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Workspace } from '../types/workspaces'

const BASE = 'https://api.autoposting.ai'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const mockWorkspaces: Workspace[] = [
  { id: 'org-1', name: 'Acme Corp', slug: 'acme', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'org-2', name: 'Side Project', slug: 'side', isActive: false, createdAt: '2024-02-01T00:00:00Z' },
]

describe('workspaces.list()', () => {
  it('sends GET /orgs and returns workspace list', async () => {
    server.use(
      http.get(`${BASE}/orgs`, () => HttpResponse.json(mockWorkspaces)),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.workspaces.list()
    expect(result).toEqual(mockWorkspaces)
    expect(result).toHaveLength(2)
  })
})

describe('workspaces.switchWorkspace()', () => {
  it('sends POST /orgs/set-active with organizationId when using session auth', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/orgs/set-active`, async ({ request }) => {
        capturedBody = await request.json()
        return new HttpResponse(null, { status: 204 })
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
