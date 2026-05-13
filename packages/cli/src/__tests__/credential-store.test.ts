import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-cred-store-test-'))
  process.env.XDG_CONFIG_HOME = tmpDir
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
  delete process.env.XDG_CONFIG_HOME
})

// Import after env is set each time
async function store() {
  // Force re-evaluation so getCredentialsPath() picks up current XDG_CONFIG_HOME
  const mod = await import('../auth/credential-store.js')
  return mod
}

const sampleProfile = () => ({
  apiKey: 'sk-test-123',
  createdAt: new Date().toISOString(),
})

describe('writeCredentials / readCredentials', () => {
  it('creates file with 0600 permissions', async () => {
    const { writeCredentials, getCredentialsPath } = await store()
    writeCredentials({ activeProfile: 'default', profiles: { default: sampleProfile() } })

    const filePath = getCredentialsPath()
    const stat = fs.statSync(filePath)
    // 0o100600 = regular file + 0600 permissions
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it('readCredentials returns null for missing file', async () => {
    const { readCredentials } = await store()
    const result = readCredentials()
    expect(result).toBeNull()
  })

  it('readCredentials returns null for corrupt JSON', async () => {
    const { readCredentials, getCredentialsPath } = await store()
    const filePath = getCredentialsPath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, '{ not valid json {{{{', 'utf8')

    const result = readCredentials()
    expect(result).toBeNull()
  })

  it('round-trips credentials correctly', async () => {
    const { writeCredentials, readCredentials } = await store()
    const creds = { activeProfile: 'default', profiles: { default: sampleProfile() } }
    writeCredentials(creds)
    expect(readCredentials()).toEqual(creds)
  })
})

describe('saveProfile', () => {
  it('adds profile and sets it as active', async () => {
    const { saveProfile, readCredentials } = await store()
    saveProfile('work', { apiKey: 'sk-work', createdAt: new Date().toISOString() })

    const creds = readCredentials()
    expect(creds?.profiles['work']?.apiKey).toBe('sk-work')
    expect(creds?.activeProfile).toBe('work')
  })

  it('preserves existing profiles when adding a new one', async () => {
    const { saveProfile, readCredentials } = await store()
    saveProfile('personal', sampleProfile())
    saveProfile('work', { apiKey: 'sk-work', createdAt: new Date().toISOString() })

    const creds = readCredentials()
    expect(Object.keys(creds?.profiles ?? {})).toHaveLength(2)
    expect(creds?.activeProfile).toBe('work')
  })
})

describe('deleteProfile', () => {
  it('removes the specified profile', async () => {
    const { saveProfile, deleteProfile, readCredentials } = await store()
    saveProfile('default', sampleProfile())
    saveProfile('work', { apiKey: 'sk-work', createdAt: new Date().toISOString() })

    deleteProfile('work')
    const creds = readCredentials()
    expect(creds?.profiles['work']).toBeUndefined()
  })

  it('switches active profile when active one is deleted', async () => {
    const { saveProfile, deleteProfile, readCredentials } = await store()
    saveProfile('personal', sampleProfile())
    saveProfile('work', { apiKey: 'sk-work', createdAt: new Date().toISOString() })
    // 'work' is now active

    deleteProfile('work')
    const creds = readCredentials()
    expect(creds?.activeProfile).toBe('personal')
  })

  it('is a no-op when credentials file does not exist', async () => {
    const { deleteProfile, readCredentials } = await store()
    expect(() => deleteProfile('nonexistent')).not.toThrow()
    expect(readCredentials()).toBeNull()
  })
})

describe('deleteAllProfiles', () => {
  it('clears all profiles and resets activeProfile', async () => {
    const { saveProfile, deleteAllProfiles, readCredentials } = await store()
    saveProfile('default', sampleProfile())
    saveProfile('work', { apiKey: 'sk-work', createdAt: new Date().toISOString() })

    deleteAllProfiles()
    const creds = readCredentials()
    expect(creds?.profiles).toEqual({})
    expect(creds?.activeProfile).toBe('')
  })
})

describe('getActiveProfile', () => {
  it('returns the active profile', async () => {
    const { saveProfile, getActiveProfile } = await store()
    saveProfile('default', { apiKey: 'sk-active', createdAt: new Date().toISOString() })

    const profile = getActiveProfile()
    expect(profile?.apiKey).toBe('sk-active')
  })

  it('returns null when no credentials file exists', async () => {
    const { getActiveProfile } = await store()
    expect(getActiveProfile()).toBeNull()
  })

  it('returns null after all profiles are deleted', async () => {
    const { saveProfile, deleteAllProfiles, getActiveProfile } = await store()
    saveProfile('default', sampleProfile())
    deleteAllProfiles()
    expect(getActiveProfile()).toBeNull()
  })
})

describe('setActiveProfile', () => {
  it('switches the active profile', async () => {
    const { saveProfile, setActiveProfile, readCredentials } = await store()
    saveProfile('personal', sampleProfile())
    saveProfile('work', { apiKey: 'sk-work', createdAt: new Date().toISOString() })

    setActiveProfile('personal')
    expect(readCredentials()?.activeProfile).toBe('personal')
  })

  it('throws when profile does not exist', async () => {
    const { saveProfile, setActiveProfile } = await store()
    saveProfile('default', sampleProfile())

    expect(() => setActiveProfile('ghost')).toThrowError(/does not exist/)
  })

  it('throws when no credentials file exists', async () => {
    const { setActiveProfile } = await store()
    expect(() => setActiveProfile('default')).toThrowError(/does not exist/)
  })
})
