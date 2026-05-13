/**
 * Integration tests for webhooks commands.
 * Spawns the built CLI binary (dist/cli.cjs) via `node <script>` using execa.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-webhooks-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap webhooks --help', () => {
  it('lists all subcommands', async () => {
    const result = await ap(['webhooks', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('get')
    expect(result.stdout).toContain('create')
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('delete')
    expect(result.stdout).toContain('test')
  })
})

describe('ap webhooks list', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['webhooks', 'list'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap webhooks get', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['webhooks', 'get', 'wh-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap webhooks create', () => {
  it('exits with error when --url is missing', async () => {
    const result = await ap(
      ['webhooks', 'create', '--events', 'post.published'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--url/)
  })

  it('exits with error when --events is missing', async () => {
    const result = await ap(
      ['webhooks', 'create', '--url', 'https://example.com/hook'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-test' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--events/)
  })
})

describe('ap webhooks delete', () => {
  it('exits with code 1 and warning when --force is not passed', async () => {
    const result = await ap(['webhooks', 'delete', 'wh-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/--force/)
  })
})

describe('ap webhooks test', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['webhooks', 'test', 'wh-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})
