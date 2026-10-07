import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execa } from 'execa'
import { startMockApi, findCreateBody } from './helpers/mock-api-server.js'

const cli = process.env.AUTOPOSTING_TEST_CLI ?? path.resolve(__dirname, '../../dist/cli.cjs')

describe('compiled Facebook MCP stdio contract', () => {
  it.each(['stored', 'env', 'flag'] as const)('uses the %s credential with normal CLI precedence', async (source) => {
    const configDir = await mkdtemp(path.join(tmpdir(), 'ap-mcp-auth-'))
    const api = await startMockApi({ expectedApiKey: `fixture-${source}` })
    const env: Record<string, string> = { PATH: process.env.PATH ?? '', XDG_CONFIG_HOME: configDir, AUTOPOSTING_BASE_URL: api.url }
    if (source !== 'stored') env.AUTOPOSTING_API_KEY = 'fixture-env'
    await mkdir(path.join(configDir, 'autoposting'))
    await writeFile(path.join(configDir, 'autoposting', 'credentials.json'), JSON.stringify({
      activeProfile: 'test', profiles: { test: { apiKey: 'fixture-stored', createdAt: '2026-01-01T00:00:00Z' } },
    }), { mode: 0o600 })
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [cli, ...(source === 'flag' ? ['--api-key', 'fixture-flag'] : []), 'mcp'], env, stderr: 'pipe' })
    const client = new Client({ name: 'mcp-login-test', version: '1.0.0' })
    try {
      await client.connect(transport)
      const result = await client.callTool({ name: 'get-brand', arguments: { brandSlug: 'test-brand' } })
      expect(result.isError).not.toBe(true)
      expect(JSON.stringify(result.content)).toContain('Fixture brand')
      expect(api.requests).toHaveLength(1)
    } finally {
      await client.close()
      await transport.close()
      await api.close()
      await rm(configDir, { recursive: true, force: true })
    }
  }, 15000)

  it('reports missing login on stderr with auth exit code and no protocol output', async () => {
    const configDir = await mkdtemp(path.join(tmpdir(), 'ap-mcp-no-auth-'))
    try {
      const result = await execa(process.execPath, [cli, 'mcp'], {
        env: { PATH: process.env.PATH ?? '', XDG_CONFIG_HOME: configDir }, extendEnv: false, reject: false,
      })
      expect(result.exitCode).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('No API key found')
      expect(result.stderr).not.toContain('at startMcpServer')
    } finally {
      await rm(configDir, { recursive: true, force: true })
    }
  })

  it.each(['text', 'link', 'photo', 'multi-photo', 'video', 'reel'])('discovers and forwards explicit %s intent', async (format) => {
    const api = await startMockApi()
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [cli, 'mcp'],
      env: { PATH: process.env.PATH ?? '', AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: api.url },
      stderr: 'pipe',
    })
    const client = new Client({ name: 'facebook-contract-test', version: '1.0.0' })
    try {
      await client.connect(transport)
      const listed = await client.listTools()
      expect(listed.tools.find(tool => tool.name === 'create-post')?.inputSchema.properties).toHaveProperty('facebookOptions')
      const image = { url: 'https://example.com/photo.png', type: 'image' }
      const media = format === 'photo' ? [image] : format === 'multi-photo' ? [image, { ...image, url: 'https://example.com/photo-2.png' }] :
        ['video', 'reel'].includes(format) ? [{ url: 'https://example.com/video.mp4', type: 'video' }] : []
      const intent = { brandSlug: 'brand', text: format === 'text' ? 'Caption' : '', platforms: ['facebook'],
        facebookOptions: { format, ...(format === 'link' ? { link: 'https://example.com/article' } : {}) },
        targetAccountIds: { facebook: ['page'] }, platformTexts: { facebook: format === 'text' ? 'Caption' : '' }, platformMedia: { facebook: media } }
      const result = await client.callTool({ name: 'create-post', arguments: intent })
      expect(result.isError).not.toBe(true)
      expect(findCreateBody(api.requests)).toMatchObject(intent)
      const updated = await client.callTool({ name: 'update-post', arguments: { id: 'post-1', ...intent } })
      expect(updated.isError).not.toBe(true)
      const update = api.requests.find(request => request.method === 'PUT' && request.path === '/posts/post-1')
      const { brandSlug: _brandSlug, ...updateIntent } = intent
      expect(update?.jsonBody).toMatchObject(updateIntent)
      const before = api.requests.length
      const invalid = await client.callTool({ name: 'create-post', arguments: { ...intent, targetAccountIds: { facebook: [] } } })
      expect(invalid.isError).toBe(true)
      expect(api.requests).toHaveLength(before)
    } finally {
      await client.close()
      await transport.close()
      await api.close()
    }
  }, 15000)

  it.each([202, 409] as const)('preserves retry HTTP %s behavior without repeating requests', async (status) => {
    const api = await startMockApi({ facebookRetryStatus: status })
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [cli, 'mcp'],
      env: { PATH: process.env.PATH ?? '', AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: api.url }, stderr: 'pipe' })
    const client = new Client({ name: 'facebook-retry-test', version: '1.0.0' })
    try {
      await client.connect(transport)
      const result = await client.callTool({ name: 'retry-post', arguments: { id: 'post-1', platform: 'facebook' } })
      expect(api.requests.map(request => `${request.method} ${request.path}`)).toEqual(['POST /posts/post-1/retry?platform=facebook'])
      expect(result.isError === true).toBe(status === 409)
      expect(JSON.stringify(result.content)).toContain(status === 202 ? 'failed-page' : 'Unknown Facebook outcome cannot be retried')
    } finally {
      await client.close()
      await transport.close()
      await api.close()
    }
  }, 15000)

  it('discovers cancellation and sends exactly one cancel request', async () => {
    const api = await startMockApi()
    const transport = new StdioClientTransport({ command: process.execPath, args: [cli, 'mcp'],
      env: { PATH: process.env.PATH ?? '', AUTOPOSTING_API_KEY: 'fixture-key', AUTOPOSTING_BASE_URL: api.url }, stderr: 'pipe' })
    const client = new Client({ name: 'schedule-cancellation-test', version: '1.0.0' })
    try {
      await client.connect(transport)
      expect((await client.listTools()).tools.map(tool => tool.name)).toContain('cancel-schedule')
      const result = await client.callTool({ name: 'cancel-schedule', arguments: { id: 'post-1' } })
      expect(result.isError).not.toBe(true)
      expect(JSON.stringify(result.content)).toContain('draft')
      expect(api.requests.map(request => [request.method, request.path, request.jsonBody])).toEqual([
        ['PUT', '/posts/post-1/schedule', { cancel: true }],
      ])
      const invalid = await client.callTool({ name: 'cancel-schedule', arguments: { id: 'post-1', scheduledAt: '2027-01-01T10:00:00Z' } })
      expect(invalid.isError).toBe(true)
      expect(api.requests).toHaveLength(1)
    } finally {
      await client.close()
      await transport.close()
      await api.close()
    }
  }, 15000)

})
