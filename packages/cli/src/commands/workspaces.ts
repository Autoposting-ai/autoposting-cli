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

export function createWorkspacesCommand(): Command {
  const workspaces = new Command('workspaces').description('Manage workspaces')

  // ap workspaces list
  workspaces
    .command('list')
    .description('List all workspaces')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching workspaces…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        // CLI auth is always an API key, so the SDK's default authSource ('api-key')
        // makes workspaces.list() fail fast with guidance instead of a bare 401.
        const client = new Autoposting({ apiKey: cred.apiKey })
        const res = await client.workspaces.list()
        spinner.stop()
        const rows = res.organizations.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          active: w.id === res.activeOrgId ? 'yes' : 'no',
          createdAt: w.createdAt,
        }))
        printer.table(rows, ['id', 'name', 'slug', 'active', 'createdAt'])
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap workspaces switch <id>
  workspaces
    .command('switch <id>')
    .description('Switch the active workspace (session auth only)')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Switching to workspace "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        // CLI auth is always an API key; the SDK's default authSource ('api-key')
        // makes switchWorkspace() reject with guidance (switching needs session auth).
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.workspaces.switchWorkspace(id)
        spinner.stop()
        printer.log(`Switched to workspace "${id}".`)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return workspaces
}
