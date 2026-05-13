/**
 * Integration tests for kb commands.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-kb-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

describe('ap kb --help', () => {
  it('lists all subcommands', async () => {
    const result = await ap(['kb', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('get')
    expect(result.stdout).toContain('create')
    expect(result.stdout).toContain('delete')
    expect(result.stdout).toContain('search')
    expect(result.stdout).toContain('ingest')
    expect(result.stdout).toContain('docs')
  })
})

describe('ap kb list', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['kb', 'list'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap kb get', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['kb', 'get', 'kb-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap kb create', () => {
  it('exits with error when --name is missing', async () => {
    const result = await ap(['kb', 'create'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toMatch(/--name/)
  })
})

describe('ap kb delete', () => {
  it('exits with code 1 and warning when --force is not passed', async () => {
    const result = await ap(['kb', 'delete', 'kb-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/--force/)
  })
})

describe('ap kb search', () => {
  it('exits with error when --query is missing', async () => {
    const result = await ap(['kb', 'search', 'kb-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--query/)
  })
})

describe('ap kb ingest', () => {
  it('exits with error when --url is missing', async () => {
    const result = await ap(['kb', 'ingest', 'kb-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.stderr + result.stdout).toMatch(/--url/)
  })
})

describe('ap kb docs', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['kb', 'docs', 'kb-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap ideas --help', () => {
  it('lists all subcommands', async () => {
    const result = await ap(['ideas', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('generate')
    expect(result.stdout).toContain('list')
    expect(result.stdout).toContain('enrich')
    expect(result.stdout).toContain('delete')
  })
})

describe('ap ideas list', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['ideas', 'list'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap ideas generate', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['ideas', 'generate', '--topic', 'AI'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})

describe('ap ideas delete', () => {
  it('exits with code 1 and warning when --force is not passed', async () => {
    const result = await ap(['ideas', 'delete', 'idea-123'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-test',
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/--force/)
  })
})

describe('ap ideas enrich', () => {
  it('exits with auth error (code 2) when no API key is set', async () => {
    const result = await ap(['ideas', 'enrich', 'idea-123'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })
})
