/**
 * Execa tests for M5 — `ap brands {set,get,clear}-default-account`. These persist
 * to ~/.config/autoposting/config.json (XDG_CONFIG_HOME → tmp); no API involved.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')
const BINARY_EXISTS = fs.existsSync(CLI)

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-default-acct-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.skipIf(!BINARY_EXISTS)('ap brands default-account (M5)', () => {
  const run = (args: string[]) => execa('node', [CLI, ...args], { env: baseEnv, reject: false })

  it('set then get round-trips per-platform defaults', async () => {
    const set = await run(['brands', 'set-default-account', 'acme', 'x=@handle', 'linkedin=all'])
    expect(set.exitCode).toBe(0)

    const get = await run(['brands', 'get-default-account', 'acme'])
    expect(get.exitCode).toBe(0)
    const parsed = JSON.parse(get.stdout)
    expect(parsed.x).toBe('@handle')
    expect(parsed.linkedin).toBe('all')
  })

  it('isolates defaults per brand', async () => {
    await run(['brands', 'set-default-account', 'acme', 'x=@a'])
    const other = await run(['brands', 'get-default-account', 'other'])
    expect(JSON.parse(other.stdout)).toEqual({})
  })

  it('clear removes a brand’s defaults', async () => {
    await run(['brands', 'set-default-account', 'acme', 'x=@handle'])
    const clear = await run(['brands', 'clear-default-account', 'acme'])
    expect(clear.exitCode).toBe(0)
    const get = await run(['brands', 'get-default-account', 'acme'])
    expect(JSON.parse(get.stdout)).toEqual({})
  })

  it('rejects a malformed pair with a non-zero exit', async () => {
    const set = await run(['brands', 'set-default-account', 'acme', 'notapair'])
    expect(set.exitCode).not.toBe(0)
    expect(set.stderr + set.stdout).toMatch(/platform=value/)
  })
})
