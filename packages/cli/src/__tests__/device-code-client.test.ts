import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { requestDeviceCode, pollDeviceCode } from '../auth/device-code-client.js'

const BASE = 'https://app.autoposting.ai'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('requestDeviceCode', () => {
  it('returns correct shape on success', async () => {
    server.use(
      http.post(`${BASE}/auth/cli/device-code`, () =>
        HttpResponse.json({
          deviceCode: 'dev-abc123',
          userCode: 'ABCD-1234',
          verificationUri: 'https://app.autoposting.ai/cli-auth',
          expiresIn: 300,
          interval: 5,
        }),
      ),
    )

    const result = await requestDeviceCode(BASE)

    expect(result.deviceCode).toBe('dev-abc123')
    expect(result.userCode).toBe('ABCD-1234')
    expect(result.verificationUri).toBe('https://app.autoposting.ai/cli-auth')
    expect(result.expiresIn).toBe(300)
    expect(result.interval).toBe(5)
  })

  it('throws on non-OK response', async () => {
    server.use(
      http.post(`${BASE}/auth/cli/device-code`, () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 }),
      ),
    )

    await expect(requestDeviceCode(BASE)).rejects.toThrow('Device code request failed (500)')
  })
})

describe('pollDeviceCode', () => {
  it('returns authorization_pending', async () => {
    server.use(
      http.get(`${BASE}/auth/cli/poll`, () =>
        HttpResponse.json({ status: 'authorization_pending' }),
      ),
    )

    const result = await pollDeviceCode(BASE, 'dev-abc123')

    expect(result.status).toBe('authorization_pending')
    expect(result.sessionToken).toBeUndefined()
  })

  it('returns complete with sessionToken', async () => {
    server.use(
      http.get(`${BASE}/auth/cli/poll`, () =>
        HttpResponse.json({
          status: 'complete',
          sessionToken: 'sk-session-xyz',
          orgId: 'org-123',
        }),
      ),
    )

    const result = await pollDeviceCode(BASE, 'dev-abc123')

    expect(result.status).toBe('complete')
    expect(result.sessionToken).toBe('sk-session-xyz')
    expect(result.orgId).toBe('org-123')
  })

  it('returns expired_token', async () => {
    server.use(
      http.get(`${BASE}/auth/cli/poll`, () =>
        HttpResponse.json({ status: 'expired_token' }),
      ),
    )

    const result = await pollDeviceCode(BASE, 'dev-abc123')

    expect(result.status).toBe('expired_token')
  })

  it('returns slow_down with new interval', async () => {
    server.use(
      http.get(`${BASE}/auth/cli/poll`, () =>
        HttpResponse.json({ status: 'slow_down', interval: 10 }),
      ),
    )

    const result = await pollDeviceCode(BASE, 'dev-abc123')

    expect(result.status).toBe('slow_down')
    expect(result.interval).toBe(10)
  })

  it('throws on non-OK response', async () => {
    server.use(
      http.get(`${BASE}/auth/cli/poll`, () =>
        HttpResponse.json({ error: 'bad request' }, { status: 400 }),
      ),
    )

    await expect(pollDeviceCode(BASE, 'dev-abc123')).rejects.toThrow('Poll request failed (400)')
  })
})
