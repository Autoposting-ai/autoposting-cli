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

export function createWebhooksCommand(): Command {
  const webhooks = new Command('webhooks').description('Manage webhooks')

  // ap webhooks list
  webhooks
    .command('list')
    .description('List all webhooks')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching webhooks…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.webhooks.list()
        spinner.stop()
        const rows = list.map((w) => ({
          id: w.id,
          url: w.url,
          events: w.events.join(', '),
          active: w.active ? 'yes' : 'no',
          createdAt: w.createdAt,
        }))
        printer.table(rows, ['id', 'url', 'events', 'active', 'createdAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap webhooks get <id>
  webhooks
    .command('get <id>')
    .description('Get a webhook by ID')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching webhook "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const webhook = await client.webhooks.retrieve(id)
        spinner.stop()
        printer.log(webhook)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap webhooks create --url <url> --events <post.published,post.failed,...>
  webhooks
    .command('create')
    .description('Create a new webhook')
    .requiredOption('--url <url>', 'Endpoint URL to receive events')
    .requiredOption('--events <list>', 'Comma-separated event types (e.g. post.published,post.failed)')
    .option('--secret <secret>', 'Signing secret for HMAC verification')
    .action(
      async (opts: { url: string; events: string; secret?: string }, cmd: Command) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner('Creating webhook…')
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const webhook = await client.webhooks.create({
            url: opts.url,
            events: opts.events.split(',').map((e) => e.trim()),
            ...(opts.secret ? { secret: opts.secret } : {}),
          })
          spinner.stop()
          printer.log(webhook)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap webhooks update <id> [--url <url>] [--events <events>] [--active]
  webhooks
    .command('update <id>')
    .description('Update a webhook')
    .option('--url <url>', 'New endpoint URL')
    .option('--events <list>', 'New comma-separated event types')
    .option('--active', 'Set webhook as active')
    .option('--no-active', 'Set webhook as inactive')
    .action(
      async (
        id: string,
        opts: { url?: string; events?: string; active?: boolean },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner(`Updating webhook "${id}"…`)
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const webhook = await client.webhooks.update(id, {
            ...(opts.url ? { url: opts.url } : {}),
            ...(opts.events ? { events: opts.events.split(',').map((e) => e.trim()) } : {}),
            ...(opts.active !== undefined ? { active: opts.active } : {}),
          })
          spinner.stop()
          printer.log(webhook)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap webhooks delete <id> --force
  webhooks
    .command('delete <id>')
    .description('Delete a webhook (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete a webhook. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting webhook "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.webhooks.remove(id)
        spinner.stop()
        printer.log(`Webhook "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap webhooks test <id>
  webhooks
    .command('test <id>')
    .description('Send a test event to a webhook')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Sending test event to webhook "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.webhooks.test(id)
        spinner.stop()
        printer.log(`Test event sent to webhook "${id}".`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return webhooks
}
