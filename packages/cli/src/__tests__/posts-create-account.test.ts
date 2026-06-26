/**
 * Execa tests for `posts create` account selector (#35).
 *
 * STATUS: PENDING-SDK-BUILD
 * All tests require the compiled binary (dist/cli.cjs) and therefore also a
 * built packages/sdk. The controller handles build order in phase-03.
 * Tests auto-skip when the binary is absent.
 *
 * Runnable-now (green once binary built, no live server):
 *   - --account with malformed pair (no =) → non-zero exit + format error
 *   - --account with unknown platform → non-zero exit + error
 *
 * Pending live-server / mock-API (need HTTP stub for GET /brands/:slug/auth/status):
 *   - non-TTY + ambiguous platform (≥2 accounts) → non-zero exit + account list
 *   - --account with unknown handle → non-zero exit + valid-accounts list
 *   - single account → no prompt, posts to default
 *   - --account resolves @handle (case-insensitive, strips leading @)
 *   - --account resolves numeric platformUserId
 *
 * Note: non-TTY ambiguous-account path requires authStatus to return ≥2 entries.
 * That path is tested here with a stub server comment; for the mock-API tests,
 * set AUTOPOSTING_BASE_URL to an msw-based stub that returns the fixture below.
 *
 * Fixture for mock server (GET /brands/my-brand/auth/status):
 * [
 *   { platform: 'x', connected: true, platformUsername: 'alice', platformUserId: 'uid-alice' },
 *   { platform: 'x', connected: true, platformUsername: 'bob',   platformUserId: 'uid-bob'   },
 * ]
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startMockApi, findCreateBody, type MockApi } from './helpers/mock-api-server'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')
const BINARY_EXISTS = fs.existsSync(CLI)

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-account-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

const BASE = ['posts', 'create', '--brand', 'my-brand', '--text', 'Hello', '--platforms', 'x']

describe.skipIf(!BINARY_EXISTS)('posts create --account flag format validation', () => {
  it('exits non-zero with format error when pair has no =', async () => {
    const result = await ap([...BASE, '--account', 'badformat'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/expected.*platform=handle/i)
  })

  it('exits non-zero with unknown-platform error', async () => {
    const result = await ap([...BASE, '--account', 'tiktok=@someuser'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/unknown platform/i)
  })
})

// ---------------------------------------------------------------------------
// Account resolution against a live local HTTP stub (asserts real request bodies)
// ---------------------------------------------------------------------------
describe.skipIf(!BINARY_EXISTS)('posts create account resolution (live stub)', () => {
  let api: MockApi
  const twoX = [
    { platform: 'x', platformUsername: 'alice', platformUserId: 'uid-alice' },
    { platform: 'x', platformUsername: 'bob', platformUserId: 'uid-bob' },
  ]

  afterEach(async () => {
    if (api) await api.close()
  })

  const envWith = (url: string) => ({ ...baseEnv, AUTOPOSTING_BASE_URL: url })

  it('non-TTY + ≥2 x accounts and no --account → non-zero exit, lists accounts + hint, no create', async () => {
    api = await startMockApi({ accounts: twoX })
    const result = await ap([...BASE], envWith(api.url))
    expect(result.exitCode).not.toBe(0)
    const out = result.stderr + result.stdout
    expect(out).toMatch(/multiple x accounts/i)
    expect(out).toMatch(/--account x=/i)
    expect(api.requests.some((r) => r.method === 'POST' && r.path.endsWith('/posts'))).toBe(false)
  })

  it('--account x=@alice resolves @handle to platformUserId in targetAccountIds', async () => {
    api = await startMockApi({ accounts: twoX })
    const result = await ap([...BASE, '--account', 'x=@alice'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    const body = findCreateBody(api.requests)
    expect(body?.targetAccountIds).toEqual({ x: ['uid-alice'] })
    expect(body?.source).toBe('cli')
  })

  it('--account x=uid-bob resolves by platformUserId', async () => {
    api = await startMockApi({ accounts: twoX })
    const result = await ap([...BASE, '--account', 'x=uid-bob'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(findCreateBody(api.requests)?.targetAccountIds).toEqual({ x: ['uid-bob'] })
  })

  it('--account x=@unknown → non-zero exit, lists valid accounts', async () => {
    api = await startMockApi({ accounts: twoX })
    const result = await ap([...BASE, '--account', 'x=@unknown'], envWith(api.url))
    expect(result.exitCode).not.toBe(0)
    const out = result.stderr + result.stdout
    expect(out).toMatch(/unknown x account/i)
    expect(out).toMatch(/alice|bob/i)
  })

  it('single x account + no --account → no prompt, creates without targetAccountIds', async () => {
    api = await startMockApi({
      accounts: [{ platform: 'x', platformUsername: 'solo', platformUserId: 'uid-solo' }],
    })
    const result = await ap([...BASE], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(findCreateBody(api.requests)?.targetAccountIds).toBeUndefined()
  })
})
