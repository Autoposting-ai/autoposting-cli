/**
 * Unit tests for M5 account selection: =all/=* fan-out, saved-default fallback,
 * and the fan-out confirm threshold. The interactive picker/confirm prompts are
 * TTY-only and covered by the non-TTY paths + the pure predicate here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveTargetAccounts, needsFanoutConfirm } from '../lib/account-select.js'
import { setDefaultAccount } from '../auth/config-store.js'

type Conn = {
  platform: string
  connected: boolean
  platformUsername?: string
  platformUserId?: string
}

function fakeClient(connections: Conn[]) {
  return {
    brands: { authStatus: async () => connections },
  } as unknown as Parameters<typeof resolveTargetAccounts>[0]['client']
}

const THREE_X: Conn[] = [
  { platform: 'x', connected: true, platformUsername: 'one', platformUserId: 'x-1' },
  { platform: 'x', connected: true, platformUsername: 'two', platformUserId: 'x-2' },
  { platform: 'x', connected: true, platformUsername: 'three', platformUserId: 'x-3' },
]

describe('needsFanoutConfirm', () => {
  it('only prompts for an explicit fan-out over the threshold on a TTY', () => {
    expect(needsFanoutConfirm(6, true, true)).toBe(true)
    expect(needsFanoutConfirm(5, true, true)).toBe(false) // at threshold, no prompt
    expect(needsFanoutConfirm(6, false, true)).toBe(false) // non-TTY never prompts
    expect(needsFanoutConfirm(6, true, false)).toBe(false) // saved default never prompts
  })
})

describe('resolveTargetAccounts =all fan-out (M5)', () => {
  it('expands =all to every connected platformUserId and emits the count', async () => {
    const emitted: string[] = []
    const result = await resolveTargetAccounts({
      brandSlug: 'b',
      platforms: ['x'],
      accountFlags: ['x=all'],
      client: fakeClient(THREE_X),
      isTty: false,
      emit: (m) => emitted.push(m),
    })
    expect(result.x).toEqual(['x-1', 'x-2', 'x-3'])
    expect(emitted.join('\n')).toMatch(/all 3/)
  })

  it('accepts =* as an alias for =all', async () => {
    const result = await resolveTargetAccounts({
      brandSlug: 'b',
      platforms: ['x'],
      accountFlags: ['x=*'],
      client: fakeClient(THREE_X),
      isTty: false,
      emit: () => {},
    })
    expect(result.x).toEqual(['x-1', 'x-2', 'x-3'])
  })
})

describe('resolveTargetAccounts saved-default fallback (M5)', () => {
  let tmpDir: string
  const prevXdg = process.env.XDG_CONFIG_HOME

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-acct-test-'))
    process.env.XDG_CONFIG_HOME = tmpDir
  })
  afterEach(() => {
    if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = prevXdg
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('uses a saved single-account default when no --account flag is given', async () => {
    setDefaultAccount('b', 'x', '@two')
    const result = await resolveTargetAccounts({
      brandSlug: 'b',
      platforms: ['x'],
      accountFlags: [],
      client: fakeClient(THREE_X),
      isTty: false,
      emit: () => {},
    })
    expect(result.x).toEqual(['x-2'])
  })

  it('uses a saved =all default to fan out without an interactive prompt', async () => {
    setDefaultAccount('b', 'x', 'all')
    const result = await resolveTargetAccounts({
      brandSlug: 'b',
      platforms: ['x'],
      accountFlags: [],
      client: fakeClient(THREE_X),
      isTty: false,
      emit: () => {},
    })
    expect(result.x).toEqual(['x-1', 'x-2', 'x-3'])
  })

  it('an explicit --account flag overrides the saved default', async () => {
    setDefaultAccount('b', 'x', 'all')
    const result = await resolveTargetAccounts({
      brandSlug: 'b',
      platforms: ['x'],
      accountFlags: ['x=@one'],
      client: fakeClient(THREE_X),
      isTty: false,
      emit: () => {},
    })
    expect(result.x).toEqual(['x-1'])
  })
})

describe('explicit Facebook Page selection', () => {
  const page = { platform: 'facebook', connected: true, platformUserId: 'page', platformUsername: 'Page' }
  it('retains the explicitly selected sole Page ID', async () => {
    expect(await resolveTargetAccounts({ brandSlug: 'facebook-brand', platforms: ['facebook'], accountFlags: ['facebook=page'],
      client: fakeClient([page]), isTty: false })).toEqual({ facebook: ['page'] })
  })
  it('requires selection even with one connected Page in noninteractive mode', async () => {
    await expect(resolveTargetAccounts({ brandSlug: 'facebook-brand', platforms: ['facebook'], accountFlags: [],
      client: fakeClient([page]), isTty: false })).rejects.toThrow('--account')
  })
  it('rejects empty all selection when no Pages are connected', async () => {
    await expect(resolveTargetAccounts({ brandSlug: 'facebook-brand', platforms: ['facebook'], accountFlags: ['facebook=all'],
      client: fakeClient([]), isTty: false, emit: () => {} })).rejects.toThrow('Facebook')
  })
})

describe('Facebook Page list selection', () => {
  const connections = [
    { platform: 'facebook', connected: true, platformUserId: 'page-1', platformUsername: 'First Page' },
    { platform: 'facebook', connected: true, platformUserId: 'page-2', platformUsername: 'Second Page' },
  ]
  it('resolves ordered comma-separated Page IDs and removes duplicates', async () => {
    expect(await resolveTargetAccounts({ brandSlug: 'facebook-list', platforms: ['facebook'],
      accountFlags: ['facebook=page-2,page-1,page-2'], client: fakeClient(connections), isTty: false }))
      .toEqual({ facebook: ['page-2', 'page-1'] })
  })
  it.each(['page-1,unknown', 'page-1,', ',page-1'])('rejects invalid or empty members in %s', async (value) => {
    await expect(resolveTargetAccounts({ brandSlug: 'facebook-list', platforms: ['facebook'],
      accountFlags: [`facebook=${value}`], client: fakeClient(connections), isTty: false })).rejects.toThrow('--account')
  })
})
