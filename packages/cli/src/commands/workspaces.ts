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
        // Pass the auth source so the SDK can fail fast with guidance under API-key auth.
        const authSource = cred.source === 'flag' || cred.source === 'env' || cred.source === 'stored'
          ? 'api-key'
          : 'session'
        const client = new Autoposting({ apiKey: cred.apiKey, authSource })
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
        // Pass the auth source so the SDK can enforce the API key restriction.
        const authSource = cred.source === 'flag' || cred.source === 'env' || cred.source === 'stored'
          ? 'api-key'
          : 'session'
        const client = new Autoposting({ apiKey: cred.apiKey, authSource })
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
