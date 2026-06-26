import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { Autoposting } from '../client'
import type { BillingStatus, CreditBalance } from '../types/billing'

const BASE = 'https://app.autoposting.ai/api-proxy'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Backend wraps every success as { success: true, data: <payload> }; the SDK unwraps it.
function wrap<T>(data: T) {
  return { success: true, data }
}

function makeClient() {
  return new Autoposting({ apiKey: 'test-key' })
}

describe('billing.status()', () => {
  it('sends GET /billing/status and returns the unwrapped status', async () => {
    const payload: BillingStatus = {
      plan: 'pro',
      planName: 'Pro',
      billingCycle: 'monthly',
      status: 'active',
      currentPeriodStart: '2024-06-01T00:00:00.000Z',
      currentPeriodEnd: '2024-07-01T00:00:00.000Z',
      trialEnd: null,
      isTrialing: false,
      cancelledAt: null,
      suspendedAt: null,
      pendingPlan: null,
      pendingChangeDate: null,
      dodoCustomerId: 'cus_123',
      setupFeeVerified: true,
      accountLimit: 10,
      accountsUsed: 3,
      creditBalance: 500,
      costMultiplier: 1.5,
    }

    server.use(http.get(`${BASE}/billing/status`, () => HttpResponse.json(wrap(payload))))

    const result = await makeClient().billing.status()
    expect(result).toEqual(payload)
  })

  it('handles a trialing subscription with an unlimited account limit', async () => {
    const payload: BillingStatus = {
      plan: 'starter',
      planName: 'Starter',
      billingCycle: 'monthly',
      status: 'trialing',
      currentPeriodStart: '2024-06-01T00:00:00.000Z',
      currentPeriodEnd: '2024-07-01T00:00:00.000Z',
      trialEnd: '2024-06-15T00:00:00.000Z',
      isTrialing: true,
      cancelledAt: null,
      suspendedAt: null,
      pendingPlan: null,
      pendingChangeDate: null,
      dodoCustomerId: null,
      setupFeeVerified: false,
      accountLimit: -1,
      accountsUsed: 1,
      creditBalance: 0,
      costMultiplier: 1.5,
    }

    server.use(http.get(`${BASE}/billing/status`, () => HttpResponse.json(wrap(payload))))

    const result = await makeClient().billing.status()
    expect(result.isTrialing).toBe(true)
    expect(result.trialEnd).toBe('2024-06-15T00:00:00.000Z')
    expect(result.accountLimit).toBe(-1)
  })
})

describe('billing.credits()', () => {
  it('sends GET /billing/credits and returns the unwrapped balance', async () => {
    const payload: CreditBalance = {
      balance: 750,
      balanceFormatted: '$7.50',
      recentUsage: [
        { date: '2024-06-20', description: 'Idea generation', amount: 12, type: 'credit_usage' },
      ],
      totalSpent30d: 2.5,
    }

    server.use(http.get(`${BASE}/billing/credits`, () => HttpResponse.json(wrap(payload))))

    const result = await makeClient().billing.credits()
    expect(result).toEqual(payload)
    expect(result.balanceFormatted).toBe('$7.50')
  })
})
