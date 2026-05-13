import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { UsageSummary } from '../types/usage'

const BASE = 'https://api.autoposting.ai'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('usage.summary()', () => {
  it('sends GET /usage/summary and returns usage data', async () => {
    const payload: UsageSummary = {
      period: '2024-06',
      platforms: {
        x: { posts: 10, published: 8, failed: 2 },
        linkedin: { posts: 5, published: 5, failed: 0 },
      },
    }
    server.use(
      http.get(`${BASE}/usage/summary`, () => HttpResponse.json(payload)),
    )
    const client = new Autoposting({ apiKey: 'test-key' })
    const result = await client.usage.summary()
    expect(result).toEqual(payload)
    expect(result.platforms['x'].published).toBe(8)
  })
})
