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
              plan: status.planName,
              status: status.status ?? '—',
              cycle: status.billingCycle ?? '—',
              accounts: `${status.accountsUsed}/${status.accountLimit === -1 ? '∞' : status.accountLimit}`,
              credits: status.creditBalance,
              renews: status.currentPeriodEnd ?? '—',
              'trial ends': status.trialEnd ?? '—',
            },
          ],
          ['plan', 'status', 'cycle', 'accounts', 'credits', 'renews', 'trial ends'],
        )
      } catch (err) {
        spinner.fail()
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
              balance: credits.balanceFormatted,
              'spent (30d)': credits.totalSpent30d,
            },
          ],
          ['balance', 'spent (30d)'],
        )
        if (credits.recentUsage.length > 0) {
          const usageRows = credits.recentUsage.map((e) => ({
            date: e.date,
            description: e.description,
            amount: e.amount,
            type: e.type,
          }))
          printer.table(usageRows, ['date', 'description', 'amount', 'type'])
        }
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return billing
}
