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

export function createIdeasCommand(): Command {
  const ideas = new Command('ideas').description('Manage content ideas')

  // ap ideas generate [--kb <id>] [--topic <text>] [--count <n>]
  ideas
    .command('generate')
    .description('Generate content ideas')
    .option('--kb <id>', 'Knowledge base ID to draw context from')
    .option('--topic <text>', 'Topic or theme for ideas')
    .option('--count <n>', 'Number of ideas to generate', '5')
    .action(async (opts: { kb?: string; topic?: string; count: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Generating ideas…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.ideas.generate({
          ...(opts.kb ? { kbId: opts.kb } : {}),
          ...(opts.topic ? { topic: opts.topic } : {}),
          count: parseInt(opts.count, 10),
        })
        spinner.stop()
        const rows = result.map((i) => ({
          id: i.id,
          topic: i.topic ?? '—',
          enriched: i.enriched ? 'yes' : 'no',
          text: i.text.length > 80 ? `${i.text.slice(0, 77)}…` : i.text,
        }))
        printer.table(rows, ['id', 'topic', 'enriched', 'text'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap ideas list
  ideas
    .command('list')
    .description('List all ideas')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching ideas…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.ideas.list()
        spinner.stop()
        const rows = list.map((i) => ({
          id: i.id,
          topic: i.topic ?? '—',
          enriched: i.enriched ? 'yes' : 'no',
          text: i.text.length > 80 ? `${i.text.slice(0, 77)}…` : i.text,
          createdAt: i.createdAt,
        }))
        printer.table(rows, ['id', 'topic', 'enriched', 'text', 'createdAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap ideas enrich <id>
  ideas
    .command('enrich <id>')
    .description('Enrich an idea with AI context')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Enriching idea "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const idea = await client.ideas.enrich(id)
        spinner.stop()
        printer.log(idea)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap ideas delete <id> [--force]
  ideas
    .command('delete <id>')
    .description('Delete an idea (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete an idea. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting idea "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.ideas.remove(id)
        spinner.stop()
        printer.log(`Idea "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return ideas
}
