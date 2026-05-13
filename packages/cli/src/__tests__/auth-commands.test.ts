/**
 * Integration tests for auth commands.
 * Spawns the built CLI binary (dist/cli.cjs) via `node <script>` using execa.
 * execaNode is avoided because it requires() the file, which breaks the shebang banner.
 * Each test gets an isolated XDG_CONFIG_HOME so credentials never bleed between tests.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-auth-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  // Remove key entirely so it doesn't leak in
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap auth whoami', () => {
  it('shows "env" source when AUTOPOSTING_API_KEY is set', async () => {
    const result = await ap(['auth', 'whoami'], { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-social-env' })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Source:  env')
  })

  it('exits with code 2 and error message when no auth available', async () => {
    const result = await ap(['auth', 'whoami'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap auth login', () => {
  it('stores credential and confirms login', async () => {
    const result = await ap(['auth', 'login', '--api-key', 'sk-social-test'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Logged in')
  })

  it('exits with code 2 when --api-key is missing', async () => {
    const result = await ap(['auth', 'login'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/--api-key/)
  })
})

describe('ap auth logout', () => {
  it('clears the active profile after login', async () => {
    // Login first
    await ap(['auth', 'login', '--api-key', 'sk-social-test'])

    // Verify stored
    const whoami = await ap(['auth', 'whoami'])
    expect(whoami.exitCode).toBe(0)
    expect(whoami.stdout).toContain('Source:  stored')

    // Logout
    const logout = await ap(['auth', 'logout'])
    expect(logout.exitCode).toBe(0)
    expect(logout.stdout).toContain('removed')

    // After logout whoami should fail
    const after = await ap(['auth', 'whoami'])
    expect(after.exitCode).toBe(2)
  })

  it('--all removes all profiles', async () => {
    await ap(['auth', 'login', '--api-key', 'sk-social-a', '--profile', 'a'])
    await ap(['auth', 'login', '--api-key', 'sk-social-b', '--profile', 'b'])

    const result = await ap(['auth', 'logout', '--all'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('All profiles removed')

    const after = await ap(['auth', 'whoami'])
    expect(after.exitCode).toBe(2)
  })
})

describe('ap auth switch', () => {
  it('switches the active profile', async () => {
    await ap(['auth', 'login', '--api-key', 'sk-social-a', '--profile', 'a'])
    await ap(['auth', 'login', '--api-key', 'sk-social-b', '--profile', 'b'])
    // 'b' is active after second login

    const sw = await ap(['auth', 'switch', 'a'])
    expect(sw.exitCode).toBe(0)
    expect(sw.stdout).toContain('Switched to profile "a"')

    const whoami = await ap(['auth', 'whoami'])
    expect(whoami.stdout).toContain('Profile: a')
  })

  it('exits with code 2 when profile does not exist', async () => {
    await ap(['auth', 'login', '--api-key', 'sk-social-test'])
    const result = await ap(['auth', 'switch', 'ghost'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/does not exist/)
  })
})
