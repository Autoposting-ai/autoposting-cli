/**
 * Execa tests for `posts create --from <csv|json>` bulk creation (N3).
 *
 * Each row is created independently: a bad row is captured and the loop
 * continues, and the command exits non-zero if ANY row failed. The summary is
 * a per-record array (JSON in non-TTY/auto mode).
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-bulk-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

function write(name: string, content: string): string {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, content)
  return p
}

const countPosts = (api: MockApi) =>
  api.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/posts')).length

describe.skipIf(!BINARY_EXISTS)('posts create --from bulk (N3)', () => {
  let api: MockApi
  afterEach(async () => {
    if (api) await api.close()
  })
  const envWith = (url: string) => ({ ...baseEnv, AUTOPOSTING_BASE_URL: url })

  it('creates one post per JSON row and exits 0', async () => {
    api = await startMockApi()
    const file = write(
      'posts.json',
      JSON.stringify([
        { brand: 'my-brand', text: 'One', platforms: ['x'] },
        { brand: 'my-brand', text: 'Two', platforms: 'x,linkedin' },
      ]),
    )
    const result = await ap(['posts', 'create', '--from', file], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(countPosts(api)).toBe(2)
    const summary = JSON.parse(result.stdout)
    expect(summary.filter((r: { status: string }) => r.status === 'created')).toHaveLength(2)
  })

  it('creates one post per CSV row using the --brand default', async () => {
    api = await startMockApi()
    const file = write('posts.csv', 'text,platforms\nHello,x\nWorld,"x,linkedin"\n')
    const result = await ap(['posts', 'create', '--from', file, '--brand', 'my-brand'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(countPosts(api)).toBe(2)
  })

  it('rejects a CSV multi-value column instead of misparsing it as a scalar', async () => {
    api = await startMockApi()
    // CSV cells are strings; `media` is array-typed. Without the guard this would
    // iterate the string per-character ("file not found: m"). Expect a clear reject.
    const file = write('posts.csv', 'text,platforms,media\nHello,x,chart.png\n')
    const result = await ap(['posts', 'create', '--from', file, '--brand', 'my-brand'], envWith(api.url))
    expect(result.exitCode).not.toBe(0)
    expect(countPosts(api)).toBe(0)
    const summary = JSON.parse(result.stdout)
    expect(summary[0].status).toBe('failed')
    expect(summary[0].error).toMatch(/multi-value/)
  })

  it('continues past a bad row and exits non-zero (partial failure)', async () => {
    api = await startMockApi()
    const file = write(
      'posts.json',
      JSON.stringify([
        { brand: 'my-brand', text: 'Good', platforms: ['x'] },
        { brand: 'my-brand', platforms: ['x'] }, // missing text → fails
      ]),
    )
    const result = await ap(['posts', 'create', '--from', file], envWith(api.url))
    expect(result.exitCode).not.toBe(0)
    expect(countPosts(api)).toBe(1)
    const summary = JSON.parse(result.stdout)
    expect(summary.filter((r: { status: string }) => r.status === 'failed')).toHaveLength(1)
  })
})
