import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const usage = {
  range: { from: '2026-10-01T00:00:00Z', to: '2026-10-03T00:00:00Z' },
  posts: { total: 4, published: 2, bySource: { dashboard: 1, api: 1, mcp: 1, cli: 1, agent: 0 } },
  agents: { total: 2, active: 1 },
  ai: { totalCostUsd: 0.2, inputTokens: 10, outputTokens: 20, totalTokens: 30, requests: 1, byModel: [] },
  trend: { posts: [{ date: '2026-10-01', count: 4 }], aiCost: [] },
}
const credits = {
  balance: 123, balanceFormatted: '123 credits', totalSpent30d: 7,
  recentUsage: [{ date: '2026-10-01', description: 'Generation', amount: 7, type: 'usage' }],
}
const server = createServer((req, res) => {
  const data = req.url === '/usage/summary' ? usage : req.url === '/billing/credits' ? credits : undefined
  res.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data ? { success: true, data } : { success: false, error: 'not found' }))
})
let directory: string
let baseUrl: string
beforeAll(async () => {
  directory = mkdtempSync(resolve(tmpdir(), 'ap-json-output-'))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  rmSync(directory, { recursive: true, force: true })
})

for (const [args, data, field, value, heading] of [
  [['usage', 'summary'], usage, '.posts.total', 4, 'POSTS'],
  [['billing', 'credits'], credits, '.balance', 123, 'BALANCE'],
] as const) {
  describe(args.join(' '), () => {
    const run = (options: string[]) => execa(process.execPath, [resolve(__dirname, '../../dist/cli.cjs'), ...args, ...options], {
      env: { ...process.env, AUTOPOSTING_API_KEY: 'sk-test-output', AUTOPOSTING_BASE_URL: baseUrl, XDG_CONFIG_HOME: directory }, reject: false,
    })
    for (const flags of [['--json'], ['--format', 'json'], []]) {
      it(`emits the complete response as one JSON value with ${flags.join(' ') || 'piped output'}`, async () => {
        const result = await run(flags)
        expect(result.exitCode).toBe(0)
        expect(JSON.parse(result.stdout)).toEqual(data)
      })
    }
    it('filters the complete object with jq', async () => {
      const result = await run(['--jq', field])
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toBe(value)
    })
    it('keeps quiet output empty', async () => {
      const result = await run(['--quiet'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('')
    })
    it('preserves explicit human table output', async () => {
      const result = await run(['--format', 'table'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(heading)
    })
  })
}
