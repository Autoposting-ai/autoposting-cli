/**
 * Minimal local HTTP stub for execa-based CLI integration tests.
 *
 * The CLI spawns a real child process that makes real HTTP calls, so an
 * in-process msw stub cannot intercept it — we need an actual server. Set
 * AUTOPOSTING_BASE_URL to `url` in the child env and the SDK routes here.
 *
 * Routes (matched by suffix so a base prefix like /api-proxy still matches):
 *   GET  …/auth/status   → { success, data: accounts }
 *   POST …/media/upload  → { success, data: { url, type, filename } }
 *   POST …/posts         → { success, data: <post> }
 *
 * Captures every request (method, path, content-type, parsed JSON body) so
 * tests can assert what the CLI actually sent.
 */
import http from 'node:http'

export interface MockAccount {
  platform: string
  connected?: boolean
  platformUsername?: string
  platformUserId?: string
}

export interface CapturedRequest {
  method: string
  path: string
  contentType: string
  jsonBody?: unknown
  raw: string
}

export interface MockApi {
  url: string
  requests: CapturedRequest[]
  close: () => Promise<void>
}

const UPLOADED = { url: 'https://cdn.example/uploaded.png', type: 'image', filename: 'uploaded.png' }

export async function startMockApi(opts: { accounts?: MockAccount[] } = {}): Promise<MockApi> {
  const accounts = (opts.accounts ?? []).map((a) => ({ connected: true, ...a }))
  const requests: CapturedRequest[] = []

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      const contentType = req.headers['content-type'] ?? ''
      const url = req.url ?? ''
      let jsonBody: unknown
      if (contentType.includes('application/json') && raw) {
        try {
          jsonBody = JSON.parse(raw)
        } catch {
          /* leave undefined */
        }
      }
      requests.push({ method: req.method ?? '', path: url, contentType, jsonBody, raw })

      const send = (data: unknown, status = 200) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ success: true, data }))
      }

      if (req.method === 'GET' && url.includes('/auth/status')) return send(accounts)
      if (req.method === 'POST' && url.endsWith('/media/upload')) return send(UPLOADED)
      if (req.method === 'PUT' && /\/posts\/[^/]+\/schedule$/.test(url)) {
        const cancel = (jsonBody as { cancel?: boolean } | undefined)?.cancel === true
        return send({
          id: 'post-1',
          brandSlug: 'my-brand',
          text: 'Hello',
          platforms: ['x'],
          status: cancel ? 'draft' : 'scheduled',
          ...(cancel ? {} : { scheduledAt: (jsonBody as { scheduledAt?: string }).scheduledAt }),
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })
      }
      if (req.method === 'POST' && url.endsWith('/posts')) {
        return send({
          id: 'post-1',
          brandSlug: 'my-brand',
          text: 'Hello',
          platforms: ['x'],
          status: 'draft',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        })
      }
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'not found' }))
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

/** Returns the parsed JSON body of the first POST whose path ends with `/posts`. */
export function findCreateBody(requests: CapturedRequest[]): Record<string, unknown> | undefined {
  const req = requests.find((r) => r.method === 'POST' && r.path.endsWith('/posts'))
  return req?.jsonBody as Record<string, unknown> | undefined
}
