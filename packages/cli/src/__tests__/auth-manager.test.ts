import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

// We'll override the credentials path via XDG_CONFIG_HOME so the real fs is
// used but in an isolated temp directory — no memfs needed.
let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-auth-manager-test-'))
  process.env.XDG_CONFIG_HOME = tmpDir
  // Clear any env key that might bleed in
  delete process.env.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.XDG_CONFIG_HOME
  delete process.env.AUTOPOSTING_API_KEY
  vi.resetModules()
})

// Re-import after env is set so getCredentialsPath() picks up the new XDG var.
async function getResolveAuth() {
  const mod = await import('../auth/auth-manager.js')
  return mod.resolveAuth
}

describe('resolveAuth', () => {
  it('returns apiKey from explicit flag (source: flag)', async () => {
    const resolveAuth = await getResolveAuth()
    const result = resolveAuth({ apiKey: 'sk-flag-key' })
    expect(result).toEqual({ apiKey: 'sk-flag-key', source: 'flag' })
  })

  it('returns apiKey from AUTOPOSTING_API_KEY env var (source: env)', async () => {
    process.env.AUTOPOSTING_API_KEY = 'sk-env-key'
    const resolveAuth = await getResolveAuth()
    const result = resolveAuth()
    expect(result).toEqual({ apiKey: 'sk-env-key', source: 'env' })
  })

  it('returns apiKey from stored credentials (source: stored)', async () => {
    // Write a credentials file into the temp dir first
    const { saveProfile } = await import('../auth/credential-store.js')
    saveProfile('default', { apiKey: 'sk-stored-key', createdAt: new Date().toISOString() })

    const resolveAuth = await getResolveAuth()
    const result = resolveAuth()
    expect(result.apiKey).toBe('sk-stored-key')
    expect(result.source).toBe('stored')
  })

  it('flag takes priority over env and stored', async () => {
    process.env.AUTOPOSTING_API_KEY = 'sk-env-key'
    const { saveProfile } = await import('../auth/credential-store.js')
    saveProfile('default', { apiKey: 'sk-stored-key', createdAt: new Date().toISOString() })

    const resolveAuth = await getResolveAuth()
    const result = resolveAuth({ apiKey: 'sk-flag-key' })
    expect(result.source).toBe('flag')
    expect(result.apiKey).toBe('sk-flag-key')
  })

  it('env takes priority over stored', async () => {
    process.env.AUTOPOSTING_API_KEY = 'sk-env-key'
    const { saveProfile } = await import('../auth/credential-store.js')
    saveProfile('default', { apiKey: 'sk-stored-key', createdAt: new Date().toISOString() })

    const resolveAuth = await getResolveAuth()
    const result = resolveAuth()
    expect(result.source).toBe('env')
    expect(result.apiKey).toBe('sk-env-key')
  })

  it('throws a clear error with exitCode 2 when no auth available', async () => {
    const resolveAuth = await getResolveAuth()
    expect(() => resolveAuth()).toThrowError(/No API key found/)
    try {
      resolveAuth()
    } catch (err) {
      expect((err as { exitCode?: number }).exitCode).toBe(2)
    }
  })
})
