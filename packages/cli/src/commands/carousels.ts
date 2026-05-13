import { Command } from 'commander'
import { Autoposting } from '@autoposting.ai/sdk'
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

export function createCarouselsCommand(): Command {
  const carousels = new Command('carousels').description('Manage carousels')

  // ap carousels list
  carousels
    .command('list')
    .description('List all carousels')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching carousels…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.carousels.list()
        spinner.stop()
        const rows = list.map((c) => ({
          id: c.id,
          title: c.title ?? '—',
          slides: c.slides.length,
          status: c.status,
          createdAt: c.createdAt,
        }))
        printer.table(rows, ['id', 'title', 'slides', 'status', 'createdAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap carousels get <id>
  carousels
    .command('get <id>')
    .description('Get a carousel by ID')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching carousel "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const carousel = await client.carousels.retrieve(id)
        spinner.stop()
        printer.log(carousel)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap carousels create [--title <title>]
  carousels
    .command('create')
    .description('Create a new carousel')
    .option('--title <title>', 'Carousel title')
    .action(async (opts: { title?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Creating carousel…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const carousel = await client.carousels.create(
          opts.title ? { title: opts.title } : undefined,
        )
        spinner.stop()
        printer.log(carousel)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap carousels generate --topic <topic> [--brand <slug>] [--slides <n>]
  carousels
    .command('generate')
    .description('AI-generate a carousel from a topic')
    .requiredOption('--topic <topic>', 'Topic to generate slides for')
    .option('--brand <slug>', 'Brand slug for brand voice')
    .option('--slides <n>', 'Number of slides to generate')
    .action(async (opts: { topic: string; brand?: string; slides?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Generating carousel…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const carousel = await client.carousels.generate({
          topic: opts.topic,
          ...(opts.brand ? { brandSlug: opts.brand } : {}),
          ...(opts.slides ? { slideCount: parseInt(opts.slides, 10) } : {}),
        })
        spinner.stop()
        printer.log(carousel)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap carousels draft <id>
  carousels
    .command('draft <id>')
    .description('Convert a carousel to a post draft')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Converting carousel "${id}" to draft…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.carousels.draft(id)
        spinner.stop()
        printer.log(result)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap carousels delete <id> --force
  carousels
    .command('delete <id>')
    .description('Delete a carousel (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete a carousel. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting carousel "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.carousels.remove(id)
        spinner.stop()
        printer.log(`Carousel "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return carousels
}
