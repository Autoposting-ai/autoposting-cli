import type { Autoposting } from '@autoposting.ai/sdk'

type Requester = Pick<Autoposting, 'request'>

/**
 * The allow-list of REST routes an assistant may call is owned by the hosted /mcp server
 * (list-api-routes). `ap api` and local `ap mcp` fetch it from there so it has one owner.
 */
export async function fetchApiRoutes(client: Requester): Promise<string[]> {
  const res = await client.request<{
    result?: { content?: { text?: string }[] }
    error?: { message?: string }
  }>('POST', '/mcp', {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'list-api-routes', arguments: {} },
  })
  try {
    const routes = (JSON.parse(res.result?.content?.[0]?.text ?? '') as { routes?: unknown }).routes
    if (Array.isArray(routes)) return routes as string[]
  } catch {
    // fall through to the error below
  }
  throw new Error(`Could not load the API allow-list from the server${res.error?.message ? `: ${res.error.message}` : ''}.`)
}

const SAFE_SEGMENT = /^[\w\-.~]+$/

/** Throws unless METHOD PATH matches an allow-list entry (`:param` matches one segment). */
export function assertApiRoute(routes: readonly string[], method: string, path: string): void {
  const m = method.toUpperCase()
  const segs = path.startsWith('/') ? path.slice(1).split('/') : []
  const safe = segs.length > 0 && segs.every((s) => SAFE_SEGMENT.test(s) && s !== '.' && s !== '..')
  const match = safe && routes.some((r) => {
    const [rm, rp] = r.split(' ')
    const rs = rp.slice(1).split('/')
    return rm === m && rs.length === segs.length && rs.every((s, i) => s.startsWith(':') || s === segs[i])
  })
  if (!match) throw new Error(`${m} ${path} is not available. Run list-api-routes (or \`ap api --list\`) to see what is.`)
}
