/**
 * Integration tests for `ap api`. Spawns the built CLI (dist/cli.cjs).
 * Prerequisite: `npm run build --workspace=packages/cli`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { parseFields } from '../commands/api.js'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-api-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap api', () => {
  it('is listed in help with its flags', async () => {
    const result = await ap(['api', '--help'])
    expect(result.exitCode).toBe(0)
    for (const flag of ['--data', '--field', '--query', '--list']) expect(result.stdout).toContain(flag)
  })

  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['api', 'GET', '/clips'])
    expect(result.exitCode).toBe(2)
  })

  it('exits with validation error (code 6) on bad --data JSON', async () => {
    const result = await ap(['api', 'POST', '/clips', '--data', '{nope'], { ...baseEnv, AUTOPOSTING_API_KEY: 'sk-social-test' })
    expect(result.exitCode).toBe(6)
    expect(result.stderr).toMatch(/--data/)
  })
})

describe('parseFields', () => {
  it('turns key=value pairs into JSON values where they parse', () => {
    expect(parseFields(['text=hello', 'limit=5', 'draft=true', 'note=a=b'])).toEqual({ text: 'hello', limit: 5, draft: true, note: 'a=b' })
  })

  it('rejects a pair without =', () => {
    expect(() => parseFields(['oops'])).toThrow(/key=value/)
  })
})
