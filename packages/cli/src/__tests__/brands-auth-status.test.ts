import { describe, it, expect } from 'vitest'
import type { PlatformConnection } from '@autoposting.ai/sdk'
import { buildAuthStatusRow, tokenStatus } from '../commands/brands.js'

// Real backend shape from GET /brands/gt/auth/status (proven via the live API):
// a connected X account whose token expired and whose refresh failed.
const expiredX: PlatformConnection = {
  platform: 'x',
  connected: true,
  platformUsername: 'iuditg',
  expiresAt: '2026-05-05T13:12:58.106Z',
  refreshError: 'Value passed for the token was invalid.',
}

const disconnected: PlatformConnection = { platform: 'linkedin', connected: false }

const NOW = Date.parse('2026-06-26T00:00:00Z') // after expiresAt above

describe('brands auth-status row (#33 username, #34 expiry)', () => {
  it('#33 maps platformUsername into the username column (was always blank)', () => {
    expect(buildAuthStatusRow(expiredX, NOW).username).toBe('iuditg')
  })

  it('#34 classifies an expired/refresh-failed token as expired, not "ok"', () => {
    expect(tokenStatus(expiredX, NOW)).toBe('expired')
    expect(buildAuthStatusRow(expiredX, NOW)['token status']).toBe('expired')
  })

  it('#34 surfaces the expiry timestamp in the expires column', () => {
    expect(buildAuthStatusRow(expiredX, NOW).expires).toBe('2026-05-05T13:12:58.106Z')
  })

  it('an unparseable expiresAt reads expired, not "ok"', () => {
    const malformed: PlatformConnection = {
      platform: 'x',
      connected: true,
      platformUsername: 'live',
      expiresAt: 'not-a-date',
    }
    expect(tokenStatus(malformed, NOW)).toBe('expired')
    expect(buildAuthStatusRow(malformed, NOW)['token status']).toBe('expired')
  })

  it('a future, healthy token reads ok', () => {
    const healthy: PlatformConnection = {
      platform: 'x',
      connected: true,
      platformUsername: 'live',
      expiresAt: '2099-01-01T00:00:00Z',
    }
    expect(tokenStatus(healthy, NOW)).toBe('ok')
  })

  it('a disconnected platform reads dashes, not "ok"', () => {
    const row = buildAuthStatusRow(disconnected, NOW)
    expect(row.username).toBe('—')
    expect(row['token status']).toBe('—')
    expect(row.expires).toBe('—')
  })
})
