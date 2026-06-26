/**
 * Integration tests for utility commands: doctor, whoami, open, update, completion.
 * Spawns the built CLI binary (dist/cli.cjs) via `node <script>` using execa.
 * Prerequisite: run `npm run build --workspace=packages/cli` before this suite.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const CLI_PACKAGE = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
  version: string
}

const CLI = path.resolve(__dirname, '../../dist/cli.cjs')

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-util-cmd-test-'))
  baseEnv = { ...process.env, XDG_CONFIG_HOME: tmpDir }
  delete baseEnv.AUTOPOSTING_API_KEY
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

function ap(args: string[], env: NodeJS.ProcessEnv = baseEnv) {
  return execa('node', [CLI, ...args], { env, reject: false })
}

// Spins a throwaway local HTTP server so subprocess CLI tests can validate against a
// controllable API (via AUTOPOSTING_BASE_URL) instead of the real production host.
async function withMockApi(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const { port } = server.address() as { port: number }
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

// ---------------------------------------------------------------------------
// ap doctor
// ---------------------------------------------------------------------------
describe('ap doctor', () => {
  it('--json outputs valid JSON array with expected check names when auth is set via env', async () => {
    // API check may fail if registry is unreachable in CI — we assert on structure, not exit code
    const result = await ap(['doctor', '--json'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    const parsed = JSON.parse(result.stdout) as Array<{
      name: string
      status: string
      value: string
    }>
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.some((c) => c.name === 'CLI Version')).toBe(true)
    expect(parsed.some((c) => c.name === 'Node.js')).toBe(true)
    const authCheck = parsed.find((c) => c.name === 'Auth')
    expect(authCheck?.status).toBe('pass')
    expect(authCheck?.value).toBe('credentials configured')
  })

  it('exits 1 and JSON includes auth fail when no credentials', async () => {
    const result = await ap(['doctor', '--json'])
    // Auth check fails → exit 1
    expect(result.exitCode).toBe(1)
    const parsed = JSON.parse(result.stdout) as Array<{
      name: string
      status: string
      value: string
    }>
    const authCheck = parsed.find((c) => c.name === 'Auth')
    expect(authCheck).toBeDefined()
    expect(authCheck?.status).toBe('fail')
    expect(authCheck?.value).toBe('not configured')
  })

  it('non-json output shows check results', async () => {
    const result = await ap(['doctor'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-test',
    })
    // May fail due to API check in CI, but output should contain check names
    expect(result.stdout).toMatch(/CLI Version/)
    expect(result.stdout).toMatch(/Node\.js/)
    expect(result.stdout).toMatch(/Auth/)
  })
})

// ---------------------------------------------------------------------------
// ap whoami
// ---------------------------------------------------------------------------
describe('ap whoami', () => {
  it('exits 2 and errors when no auth configured', async () => {
    const result = await ap(['whoami'])
    expect(result.exitCode).toBe(2)
    expect(result.stderr).toMatch(/No API key found/)
  })

  it('shows env source as unverified (exit 0) when the server is unreachable', async () => {
    const result = await ap(['whoami'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-testkey',
      AUTOPOSTING_BASE_URL: 'http://127.0.0.1:1', // refused → graceful degrade, not a hard fail
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Source:  env')
    expect(result.stdout).toContain('sk-socia') // masked key prefix
    expect(result.stdout).toContain('unverified')
  })

  it('--json outputs valid:false when the server is unreachable', async () => {
    const result = await ap(['whoami', '--json'], {
      ...baseEnv,
      AUTOPOSTING_API_KEY: 'sk-social-testkey',
      AUTOPOSTING_BASE_URL: 'http://127.0.0.1:1',
    })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.stdout) as {
      source: string
      apiKey: string
      valid: boolean
    }
    expect(parsed.source).toBe('env')
    expect(parsed.apiKey).toMatch(/^sk-socia\*+$/)
    expect(parsed.valid).toBe(false)
  })

  it('validates the key against the server and shows the active workspace', async () => {
    await withMockApi(
      (_req, res) => {
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify([
            { id: 'org-1', name: 'Acme', slug: 'acme', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
          ]),
        )
      },
      async (baseUrl) => {
        const result = await ap(['whoami'], {
          ...baseEnv,
          AUTOPOSTING_API_KEY: 'sk-social-testkey',
          AUTOPOSTING_BASE_URL: baseUrl,
        })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('Workspace: Acme (acme)')
        expect(result.stdout).toContain('valid')
      },
    )
  })

  it('exits 2 when the server rejects the key (401)', async () => {
    await withMockApi(
      (_req, res) => {
        res.statusCode = 401
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }))
      },
      async (baseUrl) => {
        const result = await ap(['whoami'], {
          ...baseEnv,
          AUTOPOSTING_API_KEY: 'sk-social-badkey',
          AUTOPOSTING_BASE_URL: baseUrl,
        })
        expect(result.exitCode).toBe(2)
      },
    )
  })
})

// ---------------------------------------------------------------------------
// ap open
// ---------------------------------------------------------------------------
describe('ap open', () => {
  it('--no-browser prints base URL to stdout', async () => {
    const result = await ap(['open', '--no-browser'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('https://app.autoposting.ai')
  })

  it('--no-browser with posts section prints posts URL', async () => {
    const result = await ap(['open', 'posts', '--no-browser'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('https://app.autoposting.ai/posts')
  })

  it('--no-browser with billing section prints billing URL', async () => {
    const result = await ap(['open', 'billing', '--no-browser'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe(
      'https://app.autoposting.ai/settings/billing',
    )
  })

  it('exits 1 for unknown section', async () => {
    const result = await ap(['open', 'unknown-section', '--no-browser'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/unknown section/)
  })
})

// ---------------------------------------------------------------------------
// ap completion
// ---------------------------------------------------------------------------
describe('ap completion', () => {
  it('outputs zsh completion script containing compadd', async () => {
    const result = await ap(['completion', 'zsh'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('compadd')
    expect(result.stdout).toContain('compdef _ap ap autoposting')
    expect(result.stdout).toContain('doctor')
    expect(result.stdout).toContain('whoami')
  })

  it('outputs bash completion script containing complete', async () => {
    const result = await ap(['completion', 'bash'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('complete -F _ap_completions ap')
    expect(result.stdout).toContain('doctor')
  })

  it('outputs fish completion script', async () => {
    const result = await ap(['completion', 'fish'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('complete -c ap')
    expect(result.stdout).toContain('doctor')
  })

  it('outputs pwsh completion script', async () => {
    const result = await ap(['completion', 'pwsh'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Register-ArgumentCompleter')
    expect(result.stdout).toContain('doctor')
  })

  it('exits 1 for unsupported shell', async () => {
    const result = await ap(['completion', 'tcsh'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toMatch(/unsupported shell/)
  })
})

// ---------------------------------------------------------------------------
// ap --help includes utility commands
// ---------------------------------------------------------------------------
describe('ap --help', () => {
  it('lists all utility commands in help output', async () => {
    const result = await ap(['--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('doctor')
    expect(result.stdout).toContain('whoami')
    expect(result.stdout).toContain('open')
    expect(result.stdout).toContain('update')
    expect(result.stdout).toContain('completion')
  })
})

describe('ap --version', () => {
  it('reports the published package version, not a stale placeholder', async () => {
    const result = await ap(['--version'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe(CLI_PACKAGE.version)
  })
})
