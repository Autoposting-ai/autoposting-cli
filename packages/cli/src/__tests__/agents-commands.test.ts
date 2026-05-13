/**
 * Integration tests for agents commands.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-agents-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap agents --help', () => {
  it('lists all subcommands', async () => {
    const result = await ap(['agents', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('get')
    expect(result.stdout).toContain('create')
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('delete')
    expect(result.stdout).toContain('run')
    expect(result.stdout).toContain('toggle')
    expect(result.stdout).toContain('runs')
  })
})

describe('ap agents create', () => {
  it('exits with error when required options are missing', async () => {
    const result = await ap(['agents', 'create'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    expect(result.exitCode).not.toBe(0)
  })

  it('exits with error when --name is missing', async () => {
    const result = await ap(
      ['agents', 'create', '--type', 'publish', '--prompt', 'test', '--frequency', 'daily'],
      { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-social-test' },
    )
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/--name/)
  })
})

describe('ap agents delete', () => {
  it('exits with error when --force is not passed', async () => {
    const result = await ap(['agents', 'delete', 'agent-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/--force/)
  })
})
