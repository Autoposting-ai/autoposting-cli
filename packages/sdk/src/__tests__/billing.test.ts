import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { BillingStatus, CreditBalance } from '../types/billing'

const BASE = 'https://app.autoposting.ai'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('billing.status()', () => {
  it('sends GET /billing/status and returns billing status', async () => {
    const payload: BillingStatus = {
      plan: 'pro',
      status: 'active',
      renewalDate: '2024-07-01T00:00:00Z',
    }
    server.use(
      http.get(`${BASE}/billing/status`, () => HttpResponse.json(payload)),
    )
    const result = await makeClient().billing.status()
    expect(result).toEqual(payload)
  })

  it('includes optional trial fields when present', async () => {
    const payload: BillingStatus = {
      plan: 'starter',
      status: 'trialing',
      trialEndsAt: '2024-06-15T00:00:00Z',
    }
    server.use(
      http.get(`${BASE}/billing/status`, () => HttpResponse.json(payload)),
    )
    const result = await makeClient().billing.status()
    expect(result.status).toBe('trialing')
    expect(result.trialEndsAt).toBe('2024-06-15T00:00:00Z')
  })
})

describe('billing.credits()', () => {
  it('sends GET /billing/credits and returns credit balance', async () => {
    const payload: CreditBalance = {
      total: 1000,
      used: 250,
      remaining: 750,
    }
    server.use(
      http.get(`${BASE}/billing/credits`, () => HttpResponse.json(payload)),
    )
    const result = await makeClient().billing.credits()
    expect(result).toEqual(payload)
  })
})
