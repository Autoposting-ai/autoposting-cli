import { Command } from 'commander'
import { Autoposting } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import { EXIT_CODES, exitCodeFromError } from '../output/exit-codes.js'
import { assertApiRoute, fetchApiRoutes } from '../lib/api-routes.js'

type GlobalOpts = {
  apiKey?: string
  json?: boolean
  quiet?: boolean
  format?: 'table' | 'json'
}

type ApiOpts = { data?: string; field: string[]; query: string[]; list?: boolean }

function validationError(message: string): Error {
  return Object.assign(new Error(message), { exitCode: EXIT_CODES.VALIDATION_ERROR })
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

/** `key=value` pairs; a value that parses as JSON (number, boolean, null, object) is used as such. */
export function parseFields(pairs: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const pair of pairs) {
    const i = pair.indexOf('=')
    if (i < 1) throw validationError(`Expected key=value, got "${pair}".`)
    const raw = pair.slice(i + 1)
    let value: unknown = raw
    try {
      value = JSON.parse(raw)
    } catch {
      // keep as string
    }
    out[pair.slice(0, i)] = value
  }
  return out
}

export function createApiCommand(): Command {
  return new Command('api')
    .description('Call any Autoposting REST route on the server allow-list, like `gh api`')
    .argument('[method]', 'GET, POST, PUT, PATCH or DELETE')
    .argument('[path]', 'Route path, e.g. /clips/abc123/jobs')
    .option('-d, --data <json>', 'JSON request body')
    .option('-f, --field <key=value>', 'Body field (repeatable)', collect, [])
    .option('-q, --query <key=value>', 'Query parameter (repeatable)', collect, [])
    .option('--list [prefix]', 'List the routes you may call')
    .action(async (method: string | undefined, path: string | undefined, opts: ApiOpts, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        let body: Record<string, unknown> | undefined
        if (opts.data !== undefined) {
          try {
            body = JSON.parse(opts.data) as Record<string, unknown>
          } catch {
            throw validationError('--data is not valid JSON.')
          }
        }
        if (opts.field.length > 0) body = { ...body, ...parseFields(opts.field) }
        const query = opts.query.length > 0 ? parseFields(opts.query) : undefined

        const client = new Autoposting({ apiKey: cred.apiKey })
        const routes = await fetchApiRoutes(client)
        if (opts.list !== undefined) {
          const prefix = typeof opts.list === 'string' ? opts.list : '/'
          printer.log(routes.filter((r) => r.split(' ')[1].startsWith(prefix)))
          return
        }
        if (!method || !path) throw validationError('Usage: ap api <METHOD> <path>, or ap api --list.')
        const m = method.toUpperCase()
        try {
          assertApiRoute(routes, m, path)
        } catch (err) {
          throw validationError((err as Error).message)
        }
        const sendBody = m === 'GET' || m === 'DELETE' ? undefined : body
        printer.log(await client.request(m as never, path, sendBody, query))
      } catch (err) {
        printer.error(err as Error)
        const attached = (err as { exitCode?: number }).exitCode
        process.exit(typeof attached === 'number' ? attached : exitCodeFromError(err))
      }
    })
}
