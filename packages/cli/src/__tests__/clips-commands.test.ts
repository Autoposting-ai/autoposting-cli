/**
 * Integration tests for clips commands.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-clips-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap clips --help', () => {
  it('lists all subcommands', async () => {
    const result = await ap(['clips', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('get')
    expect(result.stdout).toContain('upload')
    expect(result.stdout).toContain('import')
    expect(result.stdout).toContain('render')
    expect(result.stdout).toContain('delete')
  })
})

describe('ap clips list', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['clips', 'list'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap clips get', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['clips', 'get', 'clip-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap clips import', () => {
  it('exits with error when --url is missing', async () => {
    const result = await ap(['clips', 'import'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--url/)
  })
})

describe('ap clips delete', () => {
  it('exits with code 1 and warning when --force is not passed', async () => {
    const result = await ap(['clips', 'delete', 'clip-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/--force/)
  })
})
