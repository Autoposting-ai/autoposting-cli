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

export function createUsageCommand(): Command {
  const usage = new Command('usage').description('View usage statistics')

  // ap usage summary
  usage
    .command('summary')
    .description('Show usage summary for the current period')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching usage summary…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const summary = await client.usage.summary()
        spinner.stop()
        const rows = Object.entries(summary.platforms).map(([platform, stats]) => ({
          platform,
          posts: stats.posts,
          published: stats.published,
          failed: stats.failed,
        }))
        if (rows.length === 0) {
          printer.log(`No usage data for period: ${summary.period}`)
        } else {
          printer.log(`Period: ${summary.period}`)
          printer.table(rows, ['platform', 'posts', 'published', 'failed'])
        }
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return usage
}
