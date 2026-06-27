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

/**
 * Resolve the brand for an upload: use --brand if given, else auto-pick when the
 * workspace has exactly one brand. Zero or many brands → ask the user to pass --brand.
 */
async function resolveBrandId(client: Autoposting, explicit?: string): Promise<string> {
  if (explicit) return explicit
  const brands = await client.brands.list()
  if (brands.length === 1) return brands[0].id
  if (brands.length === 0) {
    throw new Error('No brands found. Create a brand first, then pass --brand <id>.')
  }
  throw new Error(
    `Multiple brands found — pass --brand <id>. Available: ${brands.map((b) => `${b.name} (${b.id})`).join(', ')}`,
  )
}

export function createClipsCommand(): Command {
  const clips = new Command('clips').description('Manage video clips')

  // ap clips list
  clips
    .command('list')
    .description('List all clips')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching clips…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.clips.list()
        spinner.stop()
        const rows = list.clips.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          duration: c.duration !== undefined ? `${c.duration}s` : '—',
        }))
        printer.table(rows, ['id', 'name', 'status', 'duration'])
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap clips get <id>
  clips
    .command('get <id>')
    .description('Get a clip by ID')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching clip "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const clip = await client.clips.retrieve(id)
        spinner.stop()
        printer.log(clip)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap clips upload <file> [--brand <id>] [--name <name>]
  clips
    .command('upload <file>')
    .description('Upload a video file as a clip')
    .option('--brand <id>', 'Brand to attach the clip to (defaults to your only brand)')
    .option('--name <name>', 'Override the clip title (defaults to filename)')
    .action(async (file: string, opts: { brand?: string; name?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Uploading clip…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const brandId = await resolveBrandId(client, opts.brand)
        const clip = await client.clips.upload(file, {
          brandId,
          ...(opts.name ? { title: opts.name } : {}),
          onProgress: (pct) => {
            if (pct > 0 && pct < 100) spinner.stop()
          },
        })
        spinner.stop()
        printer.log(clip)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap clips import --url <url> [--name <name>]
  clips
    .command('import')
    .description('Import a clip from a URL')
    .requiredOption('--url <url>', 'URL of the video to import')
    .option('--name <name>', 'Name for the imported clip')
    .action(async (opts: { url: string; name?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Importing clip…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const { clipId } = await client.clips.importUrl({
          url: opts.url,
          ...(opts.name ? { name: opts.name } : {}),
        })
        spinner.stop()
        printer.log({ clipId })
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap clips render <id>
  clips
    .command('render <id>')
    .description('Trigger rendering for a clip')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Rendering clip "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const { jobIds, activeJobIds, reusedJobIds } = await client.clips.render(id)
        spinner.stop()
        printer.log({ jobIds, activeJobIds, reusedJobIds })
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap clips delete <id> --force
  clips
    .command('delete <id>')
    .description('Delete a clip (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete a clip. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting clip "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.clips.remove(id)
        spinner.stop()
        printer.log(`Clip "${id}" deleted.`)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return clips
}
