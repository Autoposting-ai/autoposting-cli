/**
 * Execa tests for M2 — pipe-aware output default (auto) + built-in --jq.
 * Run against the compiled binary; auto-skip when dist/cli.cjs is absent.
 *
 * Child stdout is piped (non-TTY), so the `auto` default must emit JSON — the
 * footgun this fixes is `ap posts list | …` rendering an ANSI table into a pipe.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startMockApi, type MockApi } from './helpers/mock-api-server'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')
const BINARY_EXISTS = fs.existsSync(CLI)

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-output-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.skipIf(!BINARY_EXISTS)('posts list output mode (M2)', () => {
  let api: MockApi

  afterEach(async () => {
    if (api) await api.close()
  })

  const run = (args: string[]) =>
    execa('node', [CLI, ...args], {
      env: { ...baseEnv, AUTOPOSTING_BASE_URL: api.url },
      reject: false,
    })

  it('piped (non-TTY) with no format flag emits JSON.parse-able output', async () => {
    api = await startMockApi()
    const result = await run(['posts', 'list', '--brand', 'my-brand'])
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.map((p: { id: string }) => p.id)).toEqual(['post-1', 'post-2'])
  })

  it('--format table forces the human table even when piped', async () => {
    api = await startMockApi()
    const result = await run(['posts', 'list', '--brand', 'my-brand', '--format', 'table'])
    expect(result.exitCode).toBe(0)
    // Uppercased headers are the table renderer's signature; JSON would not have them.
    expect(result.stdout).toMatch(/\bID\b/)
    expect(result.stdout).toMatch(/\bSTATUS\b/)
    expect(() => JSON.parse(result.stdout)).toThrow()
  })

  it('--jq ".[].id" prints one id per line, exit 0, no external jq', async () => {
    api = await startMockApi()
    const result = await run(['posts', 'list', '--brand', 'my-brand', '--jq', '.[].id'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim().split('\n')).toEqual(['post-1', 'post-2'])
  })

  it('a bad --jq expression exits non-zero with a readable error', async () => {
    api = await startMockApi()
    const result = await run(['posts', 'list', '--brand', 'my-brand', '--jq', '.['])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/jq/i)
  })
})
