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
        printer.log(`Period: ${summary.range.from.slice(0, 10)} → ${summary.range.to.slice(0, 10)}`)
        printer.table(
          [
            {
              posts: summary.posts.total,
              published: summary.posts.published,
              agents: summary.agents.total,
              'active agents': summary.agents.active,
              'ai cost (usd)': summary.ai.totalCostUsd,
              'ai requests': summary.ai.requests,
            },
          ],
          ['posts', 'published', 'agents', 'active agents', 'ai cost (usd)', 'ai requests'],
        )
        const sourceRows = Object.entries(summary.posts.bySource).map(([source, count]) => ({
          source,
          posts: count,
        }))
        printer.table(sourceRows, ['source', 'posts'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return usage
}
