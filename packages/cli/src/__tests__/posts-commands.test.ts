/**
 * Integration tests for posts commands.
 * Spawns the built CLI binary (dist/cli.cjs) via `node <script>` using execa.
 * Tests that do not require a live API server verify command structure, flag
 * validation, and exit codes. API-dependent tests are skipped with a note.
 *
 * Prerequisite: run `npm run build --workspace=packages/cli` before this suite.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startMockApi } from './helpers/mock-api-server.js'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-posts-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap posts --help', () => {
  it('shows all subcommands in help output', async () => {
    const result = await ap(['posts', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('get')
    expect(result.stdout).toContain('create')
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('delete')
    expect(result.stdout).toContain('publish')
    expect(result.stdout).toContain('schedule')
    expect(result.stdout).toContain('retry')
    expect(result.stdout).toContain('rewrite')
    expect(result.stdout).toContain('score')
  })
})

describe('ap posts list', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['posts', 'list'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap posts get', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['posts', 'get', 'post-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap posts create', () => {
  it('exits with error when --brand is missing', async () => {
    const result = await ap([
      'posts', 'create',
      '--text', 'Hello world',
      '--platforms', 'x',
    ], { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' })
    // Commander reports missing required option and exits non-zero
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--brand/)
  })

  it('exits with error when --text is missing', async () => {
    const result = await ap([
      'posts', 'create',
      '--brand', 'my-brand',
      '--platforms', 'x',
    ], { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--text/)
  })

  it('exits with error when --platforms is missing', async () => {
    const result = await ap([
      'posts', 'create',
      '--brand', 'my-brand',
      '--text', 'Hello world',
    ], { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--platforms/)
  })
})

describe('ap posts delete', () => {
  it('exits with code 1 and warning when --force is not passed', async () => {
    const result = await ap(
      ['posts', 'delete', 'post-123'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' },
    )
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/--force/)
  })

  // #38 — when a delete fails (here: connection refused → retries exhausted),
  // the user must be warned the post may still exist so it isn't silently orphaned.
  it('warns the post may still exist when the delete request fails', async () => {
    const result = await ap(
      ['posts', 'delete', 'post-123', '--force'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test', AUTOPOSTING_BASE_URL: 'http://127.0.0.1:9' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/may not have been deleted/i)
    expect(result.stderr).toMatch(/ap posts get/)
  })
})

describe('ap posts schedule', () => {
  it('exits with error when --at is missing', async () => {
    const result = await ap(
      ['posts', 'schedule', 'post-123'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--at/)
  })
})

// #32 — a past --at must be rejected client-side before any publish/schedule call.
// validateScheduledAt runs before the SDK request, so these need no live server.
describe('ap posts schedule --at future-time validation (#32)', () => {
  it('rejects a past --at with a clear "future" error and non-zero exit', async () => {
    const result = await ap(
      ['posts', 'schedule', 'post-123', '--at', '2000-01-01T00:00:00Z'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/future/i)
  })

  it('lets a clearly-future --at pass validation (no "future" error)', async () => {
    const result = await ap(
      ['posts', 'schedule', 'post-123', '--at', '2999-01-01T00:00:00Z'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test', AUTOPOSTING_BASE_URL: 'http://127.0.0.1:9' },
    )
    // Validation passed → proceeds to the SDK call (which then fails on network),
    // so the error must NOT be the future-time validation message.
    expect(result.stderr + result.stdout).not.toMatch(/must be in the future/i)
  })
})

describe('ap posts create --at future-time validation (#32)', () => {
  it('rejects a past --at before creating the post', async () => {
    const result = await ap(
      ['posts', 'create', '--brand', 'b', '--text', 'hi', '--platforms', 'x', '--at', '2000-01-01T00:00:00Z'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/future/i)
  })
})

// #37 — a failing command must not render the success checkmark. The spinner is
// only resolved via succeed() on the success path; catch blocks now call fail() (✖).
describe('ap posts spinner fail-state (#37)', () => {
  it('does not show a success ✔ when the command fails', async () => {
    const result = await ap(['posts', 'get', 'post-xyz'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
      AUTOPOSTING_BASE_URL: 'http://127.0.0.1:9', // refused → command fails
    })
    const out = result.stdout + result.stderr
    expect(result.exitCode).not.toBe(0)
    // Piped (non-TTY) child → auto mode emits the error as JSON {"error":…};
    // a TTY would print "Error: …". Match either — the point is the failure surfaces.
    expect(out).toMatch(/error/i)
    expect(out).not.toMatch(/[✔✓]/) // no success marker on a failed command
  })
})

describe('ap posts publish', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['posts', 'publish', 'post-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap posts retry', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['posts', 'retry', 'post-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap posts rewrite', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['posts', 'rewrite', 'post-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap posts score', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['posts', 'score', 'post-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('Facebook retry command', () => {
  it('advertises explicit platform selection and its Page safety boundary', async () => {
    const result = await ap(['posts', 'retry', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--platform')
    expect(result.stdout).toContain('failed Pages')
  })
})

describe('compiled Facebook update JSON contract', () => {
  it.each([null, [], { status: 'published' }, { platforms: ['facebook,x'] }, { scheduledAt: '2000-01-01T00:00:00Z' }])('rejects malformed update files without requests: %j', async (patch) => {
    const api = await startMockApi()
    const file = path.join(tmpDir, 'invalid-update.json')
    fs.writeFileSync(file, JSON.stringify(patch))
    try {
      const result = await ap(['posts', 'update', 'post-1', '--from', file, '--json'], {
        ...baseEnv, AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: api.url,
      })
      expect(result.exitCode).not.toBe(0)
      expect(api.requests).toHaveLength(0)
    } finally { await api.close() }
  })
  it('forwards explicit format, Page IDs and empty overrides through an update file', async () => {
    const api = await startMockApi()
    const patch = { facebookOptions: { format: 'text' }, targetAccountIds: { facebook: ['page'] },
      platformTexts: { facebook: 'Edited caption', x: 'Preserved caption' }, platformMedia: { facebook: [] } }
    const file = path.join(tmpDir, 'update.json')
    fs.writeFileSync(file, JSON.stringify(patch))
    try {
      const result = await ap(['posts', 'update', 'post-1', '--from', file, '--json'], {
        ...baseEnv, AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: api.url,
      })
      expect(result.exitCode, result.stdout + result.stderr).toBe(0)
      expect(api.requests).toHaveLength(1)
      expect(api.requests[0]).toMatchObject({ method: 'PUT', path: '/posts/post-1', jsonBody: patch })
    } finally { await api.close() }
  })
})

describe('compiled Facebook retry HTTP contract', () => {
  it.each([202, 409])('forwards explicit selection once and preserves HTTP %s behavior', async (status) => {
    const paths: string[] = []
    const server = http.createServer((request, response) => {
      paths.push(`${request.method} ${request.url}`)
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(status === 202 ? { success: true, data: { id: 'post', status: 'publishing', retrying: ['facebook'], pageIds: ['failed-page'] } } :
        { success: false, error: 'Unknown Facebook outcome cannot be retried' }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Missing fixture address')
      const result = await ap(['posts', 'retry', 'post', '--platform', 'facebook', '--json'], {
        ...baseEnv, AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: `http://127.0.0.1:${address.port}`,
      })
      expect(paths).toEqual(['POST /posts/post/retry?platform=facebook'])
      if (status === 202) {
        expect(result.exitCode, result.stderr).toBe(0)
        expect(result.stdout).toContain('failed-page')
      } else {
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout + result.stderr).toContain('Unknown Facebook outcome cannot be retried')
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
  })
})
