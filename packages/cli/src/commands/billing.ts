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

export function createBillingCommand(): Command {
  const billing = new Command('billing').description('View billing information')

  // ap billing status
  billing
    .command('status')
    .description('Show current plan and subscription status')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching billing status…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const status = await client.billing.status()
        spinner.stop()
        printer.table(
          [
            {
              plan: status.plan,
              status: status.status,
              'trial ends': status.trialEndsAt ?? '—',
              'renewal date': status.renewalDate ?? '—',
              'cancels at': status.cancelAt ?? '—',
            },
          ],
          ['plan', 'status', 'trial ends', 'renewal date', 'cancels at'],
        )
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap billing credits
  billing
    .command('credits')
    .description('Show credit balance and usage breakdown')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching credit balance…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const credits = await client.billing.credits()
        spinner.stop()
        printer.table(
          [
            {
              total: credits.total,
              used: credits.used,
              remaining: credits.remaining,
            },
          ],
          ['total', 'used', 'remaining'],
        )
        if (credits.breakdown && Object.keys(credits.breakdown).length > 0) {
          const breakdownRows = Object.entries(credits.breakdown).map(([key, val]) => ({
            category: key,
            credits: val,
          }))
          printer.table(breakdownRows, ['category', 'credits'])
        }
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return billing
}
