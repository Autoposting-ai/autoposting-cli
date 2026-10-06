/**
 * Integration tests for brands commands.
 * Spawns the built CLI binary (dist/cli.cjs) via `node <script>` using execa.
 * Prerequisite: run `npm run build --workspace=packages/cli` before this suite.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startMockApi } from './helpers/mock-api-server.js'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-brands-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap brands --help', () => {
  it('prints a credential-free Facebook handoff after checking brand access', async () => {
    const api = await startMockApi()
    try {
      const result = await ap(['brands', 'connect-facebook', 'my-brand', '--no-browser', '--json'], {
        ...baseEnv, AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: api.url,
      })
      expect(result.exitCode, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ url: `${api.url}/brands?brand=my-brand&platform=facebook`, brandSlug: 'my-brand', platform: 'facebook' })
      expect(result.stdout).not.toContain('fixture-key')
      expect(api.requests.map(request => `${request.method} ${request.path}`)).toEqual(['GET /brands/my-brand'])
    } finally { await api.close() }
  })
  it('advertises Facebook browser connection and manual-open fallback', async () => {
    const result = await ap(['brands', 'connect-facebook', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('--no-browser')
    expect(result.stdout).toContain('Page')
  })
  it('lists all subcommands', async () => {
    const result = await ap(['brands', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('get')
    expect(result.stdout).toContain('create')
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('delete')
    expect(result.stdout).toContain('auth-status')
  })
})

describe('ap brands create', () => {
  it('exits with error when --name is missing', async () => {
    const result = await ap(['brands', 'create'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    // Commander exits 1 for missing required options
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/--name/)
  })
})

describe('ap brands delete', () => {
  it('exits with error when --force is not passed', async () => {
    const result = await ap(['brands', 'delete', 'my-brand'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/--force/)
  })
})
