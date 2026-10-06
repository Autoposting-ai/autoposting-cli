import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { startMockApi, findCreateBody } from './helpers/mock-api-server.js'

const cli = process.env.AUTOPOSTING_TEST_CLI ?? path.resolve(__dirname, '../../dist/cli.cjs')

describe('compiled Facebook MCP stdio contract', () => {
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
})
