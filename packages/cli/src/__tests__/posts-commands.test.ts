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
