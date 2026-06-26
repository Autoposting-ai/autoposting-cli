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
