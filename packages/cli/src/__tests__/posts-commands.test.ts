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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

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
    expect(out).toMatch(/Error:/)
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
