/**
 * Execa tests for `posts schedule <id>` — schedule + unschedule (--cancel) (M3).
 *
 * Auto-skips when the compiled binary (dist/cli.cjs) is absent (built in CI phase).
 *
 * Format/validation tests need no server. The --cancel / --at live tests assert the
 * real PUT /posts/:id/schedule body via the local HTTP stub.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { startMockApi, type MockApi, type CapturedRequest } from './helpers/mock-api-server'

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')
const BINARY_EXISTS = fs.existsSync(CLI)

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-schedule-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir, AUTOPOSTING_API_KEY: 'sk-test' }
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

/** Body of the first PUT whose path ends with /schedule. */
function findScheduleBody(requests: CapturedRequest[]): Record<string, unknown> | undefined {
  const req = requests.find((r) => r.method === 'PUT' && /\/posts\/[^/]+\/schedule$/.test(r.path))
  return req?.jsonBody as Record<string, unknown> | undefined
}

const FUTURE = '2030-06-01T10:00:00Z'

describe.skipIf(!BINARY_EXISTS)('posts schedule flag validation', () => {
  it('errors when neither --at nor --cancel is given', async () => {
    const result = await ap(['posts', 'schedule', 'post-1'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--at|--cancel/i)
  })

  it('errors when both --at and --cancel are given', async () => {
    const result = await ap(['posts', 'schedule', 'post-1', '--at', FUTURE, '--cancel'])
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/cannot.*--at.*--cancel|--at.*--cancel.*together|mutually exclusive/i)
  })
})

describe.skipIf(!BINARY_EXISTS)('posts schedule (live stub)', () => {
  let api: MockApi
  afterEach(async () => {
    if (api) await api.close()
  })
  const envWith = (url: string) => ({ ...baseEnv, AUTOPOSTING_BASE_URL: url })

  it('--cancel sends PUT /posts/:id/schedule with { cancel: true } and returns draft', async () => {
    api = await startMockApi()
    const result = await ap(['posts', 'schedule', 'post-1', '--cancel'], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(findScheduleBody(api.requests)).toEqual({ cancel: true })
  })

  it('--at sends PUT /posts/:id/schedule with { scheduledAt } and returns scheduled', async () => {
    api = await startMockApi()
    const result = await ap(['posts', 'schedule', 'post-1', '--at', FUTURE], envWith(api.url))
    expect(result.exitCode).toBe(0)
    expect(findScheduleBody(api.requests)).toEqual({ scheduledAt: FUTURE })
  })
})
