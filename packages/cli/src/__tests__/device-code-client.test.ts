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
  it('throws on non-OK response', async () => {
    server.use(
      http.post(`${BASE}/auth/cli/device-code`, () =>
        HttpResponse.json({ error: 'server error' }, { status: 500 }),
      ),
    )

    await expect(requestDeviceCode(BASE)).rejects.toThrow('Device code request failed (500)')
  })
})

describe('requestDeviceCode against the real server envelope', () => {
  it('reads the fields from the {success, data} envelope', async () => {
    server.use(
      http.post(`${BASE}/auth/cli/device-code`, () =>
        HttpResponse.json({
          success: true,
          data: {
            deviceCode: '773f303d-79b3-491a-9e24-e4a38a1f7cb9',
            userCode: 'ZQE6-QE2S',
            verificationUri: 'https://app.autoposting.ai/cli-auth',
            expiresIn: 900,
            interval: 5,
          },
        }),
      ),
    )

    const result = await requestDeviceCode(BASE)

    expect(result).toEqual({
      deviceCode: '773f303d-79b3-491a-9e24-e4a38a1f7cb9',
      userCode: 'ZQE6-QE2S',
      verificationUri: 'https://app.autoposting.ai/cli-auth',
      expiresIn: 900,
      interval: 5,
    })
  })
})

describe('pollDeviceCode', () => {
  it.each([
    [{ status: 'slow_down', interval: 10 }],
    [{ status: 'expired_token', error: 'Device code expired' }],
    [{ status: 'access_denied', error: 'User denied authorization' }],
  ])('returns the server status sent with HTTP 400: %o', async (body) => {
    server.use(http.get(`${BASE}/auth/cli/poll`, () => HttpResponse.json(body, { status: 400 })))

    const result = await pollDeviceCode(BASE, 'dev-abc123')

    expect(result.status).toBe(body.status)
  })

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
