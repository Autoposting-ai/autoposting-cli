/**
 * Execa tests for `posts create --dry-run/--preview` (N2).
 *
 * Dry-run resolves + validates the request and prints the resolved body, but
 * uploads nothing and never POSTs the post. It still hits GET /auth/status to
 * resolve accounts (so the preview is accurate), but no /media/upload and no
 * POST /posts must appear in the captured requests.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-dryrun-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

function tmpFile(name: string, content = 'data'): string {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, content)
  return p
}

const BASE = ['posts', 'create', '--brand', 'my-brand', '--text', 'Hello', '--platforms', 'x']
const hasPost = (api: MockApi) =>
  api.requests.some((r) => r.method === 'POST' && r.path.endsWith('/posts'))
const hasUpload = (api: MockApi) =>
  api.requests.some((r) => r.method === 'POST' && r.path.endsWith('/media/upload'))

describe.skipIf(!BINARY_EXISTS)('posts create --dry-run (N2)', () => {
  let api: MockApi
  afterEach(async () => {
    if (api) await api.close()
  })
  const envWith = (url: string) => ({ ...baseEnv, AUTOPOSTING_BASE_URL: url })

  it('prints the resolved request and never POSTs the post', async () => {
    api = await startMockApi()
    const result = await ap([...BASE, '--dry-run'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    const out = JSON.parse(result.stdout)
    expect(out.dryRun).toBe(true)
    expect(out.request.brandSlug).toBe('my-brand')
    expect(out.request.text).toBe('Hello')
    expect(out.request.platforms).toEqual(['x'])
    expect(hasPost(api)).toBe(false)
  })

  it('--preview is an alias for --dry-run', async () => {
    api = await startMockApi()
    const result = await ap([...BASE, '--preview'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).dryRun).toBe(true)
    expect(hasPost(api)).toBe(false)
  })

  it('leaves --media as local paths and uploads nothing', async () => {
    api = await startMockApi()
    const file = tmpFile('photo.png')
    const result = await ap([...BASE, '--media', file, '--alt-text', 'a chart', '--dry-run'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    const out = JSON.parse(result.stdout)
    expect(out.request.media).toEqual([{ path: file, altText: 'a chart' }])
    expect(hasUpload(api)).toBe(false)
    expect(hasPost(api)).toBe(false)
  })

  it('still fails fast on validation (past --at) without any network call', async () => {
    api = await startMockApi()
    const result = await ap(
      [...BASE, '--at', '2000-01-01T00:00:00Z', '--dry-run'],
      envWith(api.url),
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/future/i)
    expect(api.requests.length).toBe(0)
  })
})
