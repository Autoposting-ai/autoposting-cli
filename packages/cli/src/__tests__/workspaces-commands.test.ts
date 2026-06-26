/**
 * Integration tests for workspaces commands.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-workspaces-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap workspaces --help', () => {
  it('lists list and switch subcommands', async () => {
    const result = await ap(['workspaces', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('switch')
  })
})

describe('ap workspaces list', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['workspaces', 'list'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })

  // #39 — /orgs is session-only; under API-key auth the user must get accurate
  // guidance (key is workspace-scoped), not a bare "Unauthorized" from a failed
  // network call, and not a dead-end pointing at `ap login` (which stores an API key).
  it('exits with actionable guidance under API-key auth (not a bare Unauthorized)', async () => {
    const result = await ap(['workspaces', 'list'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/session auth/i)
    expect(result.stderr).toMatch(/single workspace/i)
    expect(result.stderr).not.toMatch(/ap login/) // dead-end loop — must not appear
  })
})

describe('ap workspaces switch', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['workspaces', 'switch', 'org-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })

  it('exits with error when API key auth is used (API keys are workspace-bound)', async () => {
    // With an API key set, the switch command will authenticate but then fail
    // at the SDK layer with the API key restriction message.
    // The CLI propagates it as exit code 1 (generic error).
    const result = await ap(['workspaces', 'switch', 'org-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/API keys are bound to a single workspace/)
  })
})
