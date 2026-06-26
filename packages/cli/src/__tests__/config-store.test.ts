import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-config-store-test-'))
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.XDG_CONFIG_HOME
})

// Re-import after env is set so getConfigPath() picks up current XDG_CONFIG_HOME.
async function store() {
  return import('../auth/config-store.js')
}

describe('config-store path + permissions', () => {
  it('writes config.json (not credentials.json) under XDG dir', async () => {
    const { getConfigPath } = await store()
    expect(getConfigPath().endsWith(path.join('autoposting', 'config.json'))).toBe(true)
  })

  it('creates file with 0600 permissions', async () => {
    const { setContextBrand, getConfigPath } = await store()
    setContextBrand('acme')
    expect(fs.statSync(getConfigPath()).mode & 0o777).toBe(0o600)
  })

  it('readConfig returns null for missing file', async () => {
    const { readConfig } = await store()
    expect(readConfig()).toBeNull()
  })

  it('readConfig returns null for corrupt JSON', async () => {
    const { readConfig, getConfigPath } = await store()
    const p = getConfigPath()
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, '{ broken {{{', 'utf8')
    expect(readConfig()).toBeNull()
  })
})

describe('context (N1)', () => {
  it('round-trips a default brand', async () => {
    const { setContextBrand, getContextBrand } = await store()
    setContextBrand('udit-goenka')
    expect(getContextBrand()).toBe('udit-goenka')
  })

  it('getContextBrand is null when unset', async () => {
    const { getContextBrand } = await store()
    expect(getContextBrand()).toBeNull()
  })

  it('unsetContextBrand clears it', async () => {
    const { setContextBrand, unsetContextBrand, getContextBrand } = await store()
    setContextBrand('acme')
    unsetContextBrand()
    expect(getContextBrand()).toBeNull()
  })

  it('setting context does not clobber default accounts', async () => {
    const { setDefaultAccount, setContextBrand, getDefaultAccount } = await store()
    setDefaultAccount('acme', 'x', '@a')
    setContextBrand('acme')
    expect(getDefaultAccount('acme', 'x')).toBe('@a')
  })
})

describe('default accounts (M5)', () => {
  it('round-trips a per-brand per-platform default', async () => {
    const { setDefaultAccount, getDefaultAccount } = await store()
    setDefaultAccount('udit-goenka', 'x', '@iuditg')
    expect(getDefaultAccount('udit-goenka', 'x')).toBe('@iuditg')
  })

  it('getDefaultAccount is null when unset', async () => {
    const { getDefaultAccount } = await store()
    expect(getDefaultAccount('acme', 'linkedin')).toBeNull()
  })

  it('getDefaultAccounts returns the whole per-brand map', async () => {
    const { setDefaultAccount, getDefaultAccounts } = await store()
    setDefaultAccount('acme', 'x', '@a')
    setDefaultAccount('acme', 'linkedin', 'all')
    expect(getDefaultAccounts('acme')).toEqual({ x: '@a', linkedin: 'all' })
  })

  it('keeps defaults isolated per brand', async () => {
    const { setDefaultAccount, getDefaultAccount } = await store()
    setDefaultAccount('acme', 'x', '@a')
    setDefaultAccount('other', 'x', '@b')
    expect(getDefaultAccount('acme', 'x')).toBe('@a')
    expect(getDefaultAccount('other', 'x')).toBe('@b')
  })

  it('clearDefaultAccounts removes a brand only', async () => {
    const { setDefaultAccount, clearDefaultAccounts, getDefaultAccount } = await store()
    setDefaultAccount('acme', 'x', '@a')
    setDefaultAccount('other', 'x', '@b')
    clearDefaultAccounts('acme')
    expect(getDefaultAccount('acme', 'x')).toBeNull()
    expect(getDefaultAccount('other', 'x')).toBe('@b')
  })
})
