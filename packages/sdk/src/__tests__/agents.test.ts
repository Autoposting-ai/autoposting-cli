import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { Agent, AgentRun } from '../types/agents'

const BASE = 'https://app.autoposting.ai/api-proxy'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Daily Publisher',
  type: 'publish',
  brandSlug: 'my-brand',
  brandName: 'My Brand',
  prompt: 'Write a post about tech trends',
  frequency: 'daily',
  time: '09:00',
  enabled: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
}

const mockRun: AgentRun = {
  id: 'run-1',
  agentId: 'agent-1',
  status: 'completed',
  output: 'Post published successfully',
  createdAt: '2024-01-02T09:00:00Z',
}

// Every backend success response is wrapped as { success: true, data: <payload> }.
// The SDK unwraps it, so mocks must wrap and assertions check the unwrapped payload.
function wrap<T>(data: T) {
  return { success: true, data }
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('AgentsResource', () => {
  it('list() sends GET /agents and returns the paginated envelope', async () => {
    const page = { items: [mockAgent], total: 1, limit: 200, offset: 0 }
    server.use(http.get(`${BASE}/agents`, () => HttpResponse.json(wrap(page))))
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.list()
    expect(result).toEqual(page)
  })

  it('retrieve() sends GET /agents/:id', async () => {
    server.use(http.get(`${BASE}/agents/agent-1`, () => HttpResponse.json(wrap(mockAgent))))
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.retrieve('agent-1')
    expect(result).toEqual(mockAgent)
  })

  it('create() sends POST /agents with params', async () => {
    let capturedBody: unknown = null
    server.use(
      http.post(`${BASE}/agents`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap(mockAgent), { status: 201 })
      }),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.create({
      name: 'Daily Publisher',
      type: 'publish',
      brandSlug: 'my-brand',
      prompt: 'Write a post about tech trends',
      frequency: 'daily',
      time: '09:00',
    })
    expect(capturedBody).toEqual({
      name: 'Daily Publisher',
      type: 'publish',
      brandSlug: 'my-brand',
      prompt: 'Write a post about tech trends',
      frequency: 'daily',
      time: '09:00',
    })
    expect(result).toEqual(mockAgent)
  })

  it('update() sends PATCH /agents/:id with params', async () => {
    let capturedBody: unknown = null
    server.use(
      http.patch(`${BASE}/agents/agent-1`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(wrap({ ...mockAgent, name: 'Updated Name' }))
      }),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.update('agent-1', { name: 'Updated Name' })
    expect(capturedBody).toEqual({ name: 'Updated Name' })
    expect(result.name).toBe('Updated Name')
  })

  it('remove() sends DELETE /agents/:id', async () => {
    let deleteCalled = false
    server.use(
      http.delete(`${BASE}/agents/agent-1`, () => {
        deleteCalled = true
        // Backend returns { success: true } with no data; the SDK unwraps to {}.
        return HttpResponse.json({ success: true })
      }),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    await client.agents.remove('agent-1')
    expect(deleteCalled).toBe(true)
  })

  it('run() sends POST /agents/:id/run and returns { runId, status }', async () => {
    server.use(
      http.post(`${BASE}/agents/agent-1/run`, () =>
        HttpResponse.json(wrap({ runId: 'run-1', status: 'pending' }), { status: 202 }),
      ),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.run('agent-1')
    expect(result).toEqual({ runId: 'run-1', status: 'pending' })
  })

  it('toggle() sends POST /agents/:id/toggle', async () => {
    const toggled = { ...mockAgent, enabled: false }
    server.use(http.post(`${BASE}/agents/agent-1/toggle`, () => HttpResponse.json(wrap(toggled))))
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.toggle('agent-1')
    expect(result.enabled).toBe(false)
  })

  it('runs() sends GET /agents/:id/runs and returns the paginated envelope', async () => {
    const page = { items: [mockRun], total: 1, limit: 50, offset: 0 }
    server.use(http.get(`${BASE}/agents/agent-1/runs`, () => HttpResponse.json(wrap(page))))
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.agents.runs('agent-1')
    expect(result).toEqual(page)
  })
})
