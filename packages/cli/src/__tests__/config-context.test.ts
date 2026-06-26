/**
 * Execa tests for N1 — `ap config {set,get,unset}-context` + brand resolution.
 * Context lives in ~/.config/autoposting/config.json (XDG_CONFIG_HOME points at a
 * tmp dir per test). Run against the compiled binary; skip when dist is absent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startMockApi, type MockApi } from './helpers/mock-api-server'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')
const BINARY_EXISTS = fs.existsSync(CLI)

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-ctx-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.skipIf(!BINARY_EXISTS)('ap config context (N1)', () => {
  const run = (args: string[], env: NodeJS.ProcessEnv = baseEnv) =>
    execa('node', [CLI, ...args], { env, reject: false })

  it('set-context then get-context round-trips the brand', async () => {
    const set = await run(['config', 'set-context', '--brand', 'acme'])
    expect(set.exitCode).toBe(0)
    expect(JSON.parse(set.stdout).brand).toBe('acme')

    const get = await run(['config', 'get-context'])
    expect(get.exitCode).toBe(0)
    expect(JSON.parse(get.stdout).brand).toBe('acme')
  })

  it('get-context exits non-zero with guidance when no context is set', async () => {
    const get = await run(['config', 'get-context'])
    expect(get.exitCode).not.toBe(0)
    expect(get.stderr + get.stdout).toMatch(/set-context/)
  })

  it('unset-context clears the saved brand', async () => {
    await run(['config', 'set-context', '--brand', 'acme'])
    const unset = await run(['config', 'unset-context'])
    expect(unset.exitCode).toBe(0)

    const get = await run(['config', 'get-context'])
    expect(get.exitCode).not.toBe(0)
  })

  it('writes config.json with 0600 perms', async () => {
    await run(['config', 'set-context', '--brand', 'acme'])
    const file = path.join(tmpDir, 'autoposting', 'config.json')
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.statSync(file).mode & 0o777).toBe(0o600)
  })
})

describe.skipIf(!BINARY_EXISTS)('brand resolution falls back to context (N1)', () => {
  let api: MockApi

  afterEach(async () => {
    if (api) await api.close()
  })

  it('posts list with no --brand uses the saved context brand', async () => {
    api = await startMockApi()
    const env = { ...baseEnv, AUTOPOSTING_BASE_URL: api.url }
    await execa('node', [CLI, 'config', 'set-context', '--brand', 'acme'], { env, reject: false })
    const result = await execa('node', [CLI, 'posts', 'list'], { env, reject: false })
    expect(result.exitCode).toBe(0)
    const listReq = api.requests.find((r) => r.method === 'GET' && /\/posts/.test(r.path))
    expect(listReq?.path).toMatch(/brandSlug=acme/)
  })

  it('posts create with neither --brand nor context fails fast before any network call', async () => {
    const result = await execa(
      'node',
      [CLI, 'posts', 'create', '--text', 'hi', '--platforms', 'x'],
      { env: { ...baseEnv, AUTOPOSTING_BASE_URL: 'http://127.0.0.1:9' }, reject: false },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/brand/i)
    expect(result.stderr + result.stdout).toMatch(/set-context/)
  })
})
