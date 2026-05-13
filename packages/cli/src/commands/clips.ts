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
        const rows = list.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          duration: c.duration !== undefined ? `${c.duration}s` : '—',
        }))
        printer.table(rows, ['id', 'name', 'status', 'duration'])
      } catch (err) {
        spinner.stop()
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
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap clips upload <file> [--name <name>]
  clips
    .command('upload <file>')
    .description('Upload a video file as a clip')
    .option('--name <name>', 'Override the clip name (defaults to filename)')
    .action(async (file: string, opts: { name?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Uploading clip…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const clip = await client.clips.upload(file, {
          name: opts.name,
          onProgress: (pct) => {
            if (pct > 0 && pct < 100) spinner.stop()
          },
        })
        spinner.stop()
        printer.log(clip)
      } catch (err) {
        spinner.stop()
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
        const clip = await client.clips.importUrl({
          url: opts.url,
          ...(opts.name ? { name: opts.name } : {}),
        })
        spinner.stop()
        printer.log(clip)
      } catch (err) {
        spinner.stop()
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
        const clip = await client.clips.render(id)
        spinner.stop()
        printer.log(clip)
      } catch (err) {
        spinner.stop()
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
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return clips
}
