import { describe, it, expect } from 'vitest'
import { fetchApiRoutes, assertApiRoute } from '../lib/api-routes.js'
import { handleToolCall } from '../mcp/handler.js'
import { ALL_TOOLS } from '../mcp/tools.js'

const ROUTES = ['GET /clips/:clipId/jobs', 'POST /posts/:id/instagram-comments/:commentId/reply']

// The hosted /mcp server owns the allow-list; the CLI asks it through list-api-routes.
function hostedClient(routes: string[] | Error, calls: unknown[] = []) {
  return {
    request: async (method: string, path: string, body?: unknown, query?: unknown) => {
      calls.push([method, path, body, query])
      if (path === '/mcp') {
        if (routes instanceof Error) throw routes
        return { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify({ routes }) }] } }
      }
      return { ok: true }
    },
  }
}

describe('allow-list from the hosted server', () => {
  it('reads the routes from the hosted list-api-routes tool', async () => {
    const calls: unknown[] = []
    expect(await fetchApiRoutes(hostedClient(ROUTES, calls) as never)).toEqual(ROUTES)
    expect(calls[0]).toEqual(['POST', '/mcp', {
      jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list-api-routes', arguments: {} },
    }, undefined])
  })

  it('fails when the hosted server returns an error', async () => {
    const client = { request: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Tool not found' } }) }
    await expect(fetchApiRoutes(client as never)).rejects.toThrow(/allow-list/)
  })

  it('accepts a listed route and fills params', () => {
    expect(() => assertApiRoute(ROUTES, 'get', '/clips/c1/jobs')).not.toThrow()
    expect(() => assertApiRoute(ROUTES, 'POST', '/posts/p1/instagram-comments/k1/reply')).not.toThrow()
  })

  it.each([
    ['DELETE', '/account'],
    ['POST', '/clips/c1/jobs'],
    ['GET', '/clips/../account'],
    ['GET', '/clips/%2e%2e/jobs'],
    ['GET', 'https://evil.example/clips'],
    ['GET', '/clips//jobs'],
    ['GET', '/clips/c1/jobs?x=1'],
  ])('refuses %s %s', (method, path) => {
    expect(() => assertApiRoute(ROUTES, method, path)).toThrow(/not available/)
  })
})

describe('local ap mcp api-request', () => {
  it('calls an allowed route with query and body', async () => {
    const calls: unknown[] = []
    const res = await handleToolCall('api-request', { method: 'POST', path: '/posts/p1/instagram-comments/k1/reply', body: { text: 'hi' } }, hostedClient(ROUTES, calls) as never)
    expect(res.isError).toBeUndefined()
    expect(calls.at(-1)).toEqual(['POST', '/posts/p1/instagram-comments/k1/reply', { text: 'hi' }, undefined])
  })

  it('refuses a route off the list without calling it', async () => {
    const calls: unknown[] = []
    const res = await handleToolCall('api-request', { method: 'DELETE', path: '/account' }, hostedClient(ROUTES, calls) as never)
    expect(res.isError).toBe(true)
    expect(calls.some((c) => (c as string[])[1] === '/account')).toBe(false)
  })

  it('refuses everything when the allow-list cannot be fetched', async () => {
    const calls: unknown[] = []
    const res = await handleToolCall('api-request', { method: 'GET', path: '/clips/c1/jobs' }, hostedClient(new Error('offline'), calls) as never)
    expect(res.isError).toBe(true)
    expect(calls.some((c) => (c as string[])[1] === '/clips/c1/jobs')).toBe(false)
  })

  it('drops the body on GET and DELETE', async () => {
    const calls: unknown[] = []
    await handleToolCall('api-request', { method: 'GET', path: '/clips/c1/jobs', query: { limit: 5 }, body: { x: 1 } }, hostedClient(ROUTES, calls) as never)
    expect(calls.at(-1)).toEqual(['GET', '/clips/c1/jobs', undefined, { limit: 5 }])
  })

  it('list-api-routes filters by prefix', async () => {
    const res = await handleToolCall('list-api-routes', { prefix: '/clips' }, hostedClient(ROUTES, []) as never)
    expect(JSON.parse((res.content[0] as { text: string }).text)).toEqual({ routes: ['GET /clips/:clipId/jobs'] })
  })
})

describe('local ap mcp file uploads', () => {
  it('upload-media sends a local file and returns a media item for create-post', async () => {
    const seen: unknown[] = []
    const client = { media: { upload: async (p: { filename: string; contentType: string; data: Uint8Array }) => { seen.push([p.filename, p.contentType, p.data.length]); return { url: 'https://cdn.example.com/a.png', type: 'image' } } } }
    const file = new URL('./fixtures/one-pixel.png', import.meta.url).pathname
    const res = await handleToolCall('upload-media', { filePath: file, altText: 'dot' }, client as never)
    expect(seen).toEqual([['one-pixel.png', 'image/png', 67]])
    expect(JSON.parse((res.content[0] as { text: string }).text)).toEqual({ url: 'https://cdn.example.com/a.png', type: 'image', altText: 'dot' })
  })

  it('upload-clip hands the file path to the multipart clip upload', async () => {
    const seen: unknown[] = []
    const client = { clips: { upload: async (path: string, opts: unknown) => { seen.push([path, opts]); return { id: 'c1' } } } }
    await handleToolCall('upload-clip', { filePath: '/v/talk.mp4', brandId: 'b1', title: 'Talk' }, client as never)
    expect(seen).toEqual([['/v/talk.mp4', { brandId: 'b1', title: 'Talk' }]])
  })

  it('publish-clip posts the rendered candidate', async () => {
    const calls: unknown[] = []
    await handleToolCall('publish-clip', { id: 'c1', mode: 'draft', candidateId: 'k1', platforms: 'x,linkedin' }, hostedClient(ROUTES, calls) as never)
    expect(calls).toEqual([['POST', '/clips/c1/publish', { mode: 'draft', candidateId: 'k1', platforms: ['x', 'linkedin'] }, undefined]])
  })

  it('all five tools are defined', () => {
    const names = ALL_TOOLS.map((t) => t.name)
    for (const n of ['api-request', 'list-api-routes', 'upload-media', 'upload-clip', 'publish-clip']) expect(names).toContain(n)
  })
})
