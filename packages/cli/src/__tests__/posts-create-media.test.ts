/**
 * Execa tests for `posts create` media flags (#31).
 *
 * STATUS: PENDING-SDK-BUILD
 * All tests in this file require the compiled binary (dist/cli.cjs), which in
 * turn requires packages/sdk to be built first. The controller handles this in
 * phase-03 (`npm run build --workspace=packages/sdk && npm run build
 * --workspace=packages/cli`). Tests are skipped automatically when the binary
 * does not exist so the suite still passes in CI during parallel phases.
 *
 * Runnable-now (green once binary built, no live server needed):
 *   - malformed --platform-text pair → non-zero exit + message
 *   - unknown platform in --platform-text → non-zero exit + message
 *   - malformed --platform-media pair → non-zero exit + message
 *   - unknown platform in --platform-media → non-zero exit + message
 *   - --media with a missing file → non-zero exit + clear error
 *   - --media with >10 files → non-zero exit + "at most 10" message
 *   - --alt-text with more entries than --media → non-zero exit
 *   - --ig-thumb-offset-ms non-numeric → non-zero exit
 *
 * Pending live-server / mock-API (need HTTP stub, also pending binary):
 *   - successful upload + create (happy path)
 *   - --platform-media uploads and attaches to correct platform
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-media-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

/** Write a minimal valid file into tmpDir and return its path. */
function tmpFile(name: string, content = 'data'): string {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, content)
  return p
}

// Base args that satisfy required flags (keeps individual tests focused on one thing).
const BASE = ['posts', 'create', '--brand', 'my-brand', '--text', 'Hello', '--platforms', 'x']

describe.skipIf(!BINARY_EXISTS)('posts create --platform-text validation', () => {
  it('exits non-zero with message on malformed pair (no =)', async () => {
    const result = await ap([...BASE, '--platform-text', 'badformat'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/expected.*platform=value/i)
  })

  it('exits non-zero with message on unknown platform', async () => {
    const result = await ap([...BASE, '--platform-text', 'tiktok=hi'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/unknown platform/i)
  })
})

describe.skipIf(!BINARY_EXISTS)('posts create --platform-media validation', () => {
  it('exits non-zero with message on malformed pair (no =)', async () => {
    const result = await ap([...BASE, '--platform-media', 'badformat'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/expected.*platform=path/i)
  })

  it('exits non-zero with message on unknown platform', async () => {
    const result = await ap([...BASE, '--platform-media', 'twitter=photo.jpg'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/unknown platform/i)
  })
})

describe.skipIf(!BINARY_EXISTS)('posts create --media validation', () => {
  it('exits non-zero with clear error when a file is missing', async () => {
    const missing = path.join(tmpDir, 'nonexistent.jpg')
    const result = await ap([...BASE, '--media', missing])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/not found/i)
    expect(result.stderr + result.stdout).toContain(missing)
  })

  it('exits non-zero with "at most 10" when >10 files are passed', async () => {
    // Create 11 valid files
    const files = Array.from({ length: 11 }, (_, i) => tmpFile(`img${i}.jpg`))
    const result = await ap([...BASE, '--media', ...files])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/at most 10/i)
  })

  it('exits non-zero when --alt-text has more entries than --media', async () => {
    const file = tmpFile('photo.jpg')
    const result = await ap([
      ...BASE,
      '--media', file,
      '--alt-text', 'Alt A', 'Alt B',
    ])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/more values/i)
  })
})

describe.skipIf(!BINARY_EXISTS)('posts create Instagram/Reel validation', () => {
  it('exits non-zero when --ig-thumb-offset-ms is not a number', async () => {
    const result = await ap([
      ...BASE,
      '--ig-reel',
      '--ig-thumb-offset-ms', 'notanumber',
    ])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/non-negative number/i)
  })
})

// ---------------------------------------------------------------------------
// Media upload happy-path against a live local HTTP stub (asserts real bodies)
// ---------------------------------------------------------------------------
describe.skipIf(!BINARY_EXISTS)('posts create media upload (live stub)', () => {
  let api: MockApi
  afterEach(async () => {
    if (api) await api.close()
  })
  const envWith = (url: string) => ({ ...baseEnv, AUTOPOSTING_BASE_URL: url })

  it('uploads --media file (multipart) and attaches {url,type} to the create body', async () => {
    api = await startMockApi()
    const file = tmpFile('photo.png')
    const result = await ap([...BASE, '--media', file], envWith(api.url))
    expect(result.exitCode).toBe(0)
    const upload = api.requests.find((r) => r.method === 'POST' && r.path.endsWith('/media/upload'))
    expect(upload?.contentType).toMatch(/^multipart\/form-data/)
    expect(upload?.raw).toContain('photo.png')
    const body = findCreateBody(api.requests)
    expect(body?.media).toEqual([{ url: 'https://cdn.example/uploaded.png', type: 'image' }])
    expect(body?.source).toBe('cli')
  })

  it('--alt-text aligns to --media by index in the create body', async () => {
    api = await startMockApi()
    const file = tmpFile('photo.png')
    const result = await ap([...BASE, '--media', file, '--alt-text', 'a chart'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(findCreateBody(api.requests)?.media).toEqual([
      { url: 'https://cdn.example/uploaded.png', type: 'image', altText: 'a chart' },
    ])
  })

  it('--platform-media uploads and attaches under the right platform', async () => {
    api = await startMockApi()
    const file = tmpFile('banner.png')
    const result = await ap([...BASE, '--platform-media', `x=${file}`], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(findCreateBody(api.requests)?.platformMedia).toEqual({
      x: [{ url: 'https://cdn.example/uploaded.png', type: 'image' }],
    })
  })
})

// ---------------------------------------------------------------------------
// Fail-fast: an unsupported extension on an existing file must error BEFORE any
// network call (no auth-status, no upload, no create) — pure pre-network pass (M4).
// ---------------------------------------------------------------------------
describe.skipIf(!BINARY_EXISTS)('posts create media extension validation is fail-fast', () => {
  let api: MockApi
  afterEach(async () => {
    if (api) await api.close()
  })
  const envWith = (url: string) => ({ ...baseEnv, AUTOPOSTING_BASE_URL: url })

  it('--media with unsupported extension (file exists) errors with no network call', async () => {
    api = await startMockApi()
    const file = tmpFile('photo.bmp') // exists on disk, but .bmp is unsupported
    const result = await ap([...BASE, '--media', file], envWith(api.url))
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/unsupported file extension/i)
    expect(api.requests.length).toBe(0)
  })

  it('--platform-media with unsupported extension errors with no network call', async () => {
    api = await startMockApi()
    const file = tmpFile('banner.tiff')
    const result = await ap([...BASE, '--platform-media', `x=${file}`], envWith(api.url))
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/unsupported file extension/i)
    expect(api.requests.length).toBe(0)
  })
})
