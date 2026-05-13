import { Command } from 'commander'
import { Autoposting } from '@autoposting/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import { exitCodeFromError } from '../output/exit-codes.js'

type GlobalOpts = {
  apiKey?: string
  json?: boolean
  quiet?: boolean
  format?: 'table' | 'json'
}

function resolveExitCode(err: unknown): number {
  const attached = (err as { exitCode?: number }).exitCode
  if (typeof attached === 'number') return attached
  return exitCodeFromError(err)
}

export function createKbCommand(): Command {
  const kb = new Command('kb').description('Manage knowledge bases')

  // ap kb list
  kb
    .command('list')
    .description('List all knowledge bases')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching knowledge bases…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.kb.list()
        spinner.stop()
        const rows = list.map((k) => ({
          id: k.id,
          name: k.name,
          docs: k.docCount ?? 0,
          createdAt: k.createdAt,
        }))
        printer.table(rows, ['id', 'name', 'docs', 'createdAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap kb get <id>
  kb
    .command('get <id>')
    .description('Get a knowledge base by ID')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching knowledge base "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.kb.retrieve(id)
        spinner.stop()
        printer.log(result)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap kb create --name <name>
  kb
    .command('create')
    .description('Create a new knowledge base')
    .requiredOption('--name <name>', 'Knowledge base name')
    .action(async (opts: { name: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Creating knowledge base…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.kb.create({ name: opts.name })
        spinner.stop()
        printer.log(result)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap kb delete <id> [--force]
  kb
    .command('delete <id>')
    .description('Delete a knowledge base (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete a knowledge base. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting knowledge base "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.kb.remove(id)
        spinner.stop()
        printer.log(`Knowledge base "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap kb search <id> --query <text>
  kb
    .command('search <id>')
    .description('Search a knowledge base')
    .requiredOption('--query <text>', 'Search query')
    .action(async (id: string, opts: { query: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Searching knowledge base "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const results = await client.kb.search(id, opts.query)
        spinner.stop()
        const rows = results.map((r) => ({
          docId: r.docId,
          score: r.score.toFixed(3),
          content: r.content.length > 80 ? `${r.content.slice(0, 77)}…` : r.content,
        }))
        printer.table(rows, ['docId', 'score', 'content'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap kb ingest <id> --url <url>
  kb
    .command('ingest <id>')
    .description('Ingest a URL into a knowledge base')
    .requiredOption('--url <url>', 'URL to ingest')
    .action(async (id: string, opts: { url: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Ingesting URL into knowledge base "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const doc = await client.kb.ingestUrl(id, opts.url)
        spinner.stop()
        printer.log(doc)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap kb docs <id>
  kb
    .command('docs <id>')
    .description('List documents in a knowledge base')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching documents for knowledge base "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const docs = await client.kb.docs(id)
        spinner.stop()
        const rows = docs.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          status: d.status,
          createdAt: d.createdAt,
        }))
        printer.table(rows, ['id', 'name', 'type', 'status', 'createdAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return kb
}
