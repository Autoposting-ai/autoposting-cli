import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { UsageSummary } from '../types/usage'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Backend wraps every success as { success: true, data: <payload> }; the SDK unwraps it.
function wrap<T>(data: T) {
  return { success: true, data }
}

describe('usage.summary()', () => {
  it('sends GET /usage/summary and returns the unwrapped summary', async () => {
    const payload: UsageSummary = {
      range: { from: '2024-06-01T00:00:00.000Z', to: '2024-06-30T23:59:59.999Z' },
      posts: {
        total: 15,
        published: 13,
        bySource: { dashboard: 10, api: 3, mcp: 1, cli: 1, agent: 0 },
      },
      agents: { total: 2, active: 1 },
      ai: {
        totalCostUsd: 1.2345,
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        requests: 8,
        byModel: [
          { model: 'gpt-4o', costUsd: 1.2, inputTokens: 900, outputTokens: 400, requests: 6 },
        ],
      },
      trend: {
        posts: [{ date: '2024-06-01', count: 3 }],
        aiCost: [{ date: '2024-06-01', costUsd: 0.5, requests: 2 }],
      },
    }

    server.use(http.get(`${BASE}/usage/summary`, () => HttpResponse.json(wrap(payload))))

    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.usage.summary()

    expect(result).toEqual(payload)
    expect(result.posts.bySource.api).toBe(3)
    expect(result.ai.byModel[0].model).toBe('gpt-4o')
  })
})
