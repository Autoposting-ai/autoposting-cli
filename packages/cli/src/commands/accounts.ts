import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { Autoposting } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import { exitCodeFromError } from '../output/exit-codes.js'
type Globals = {
  apiKey?: string
  json?: boolean
  quiet?: boolean
  format?: 'table' | 'json'
}
async function run(
  cmd: Command,
  action: (client: Autoposting) => Promise<unknown>,
) {
  const globals = cmd.optsWithGlobals<Globals>()
  const printer = createPrinter(globals)
  try {
    const cred = resolveAuth({ apiKey: globals.apiKey })
    printer.log(await action(new Autoposting({ apiKey: cred.apiKey })))
  } catch (err) {
    printer.error(err as Error)
    process.exitCode = exitCodeFromError(err)
  }
}
export function createAccountsCommand() {
  const command = new Command('accounts').description(
    'Import account CSVs and connect through browser approval; progress lives in the workspace',
  )
  command
    .command('import')
    .requiredOption(
      '--from <csv>',
      'CSV with brand_name,platform,account_url; optional brand_slug,timezone',
    )
    .action(async (opts: { from: string }, cmd: Command) =>
      run(cmd, async (client) =>
        client.accountOnboarding.create({
          csv: await readFile(opts.from, 'utf8'),
        }),
      ),
    )
  command
    .command('prepare <importId>')
    .option('--offset <number>', 'Resume at this row offset', '0')
    .description(
      'Create/reuse the next 25 brands; repeat with nextOffset until null',
    )
    .action(async (id: string, opts: { offset: string }, cmd: Command) =>
      run(cmd, async (client) => {
        const offset = Number(opts.offset)
        if (!Number.isInteger(offset) || offset < 0)
          throw new Error('offset must be a nonnegative integer')
        return client.accountOnboarding.prepare(id, offset)
      }),
    )
  command
    .command('status <importId>')
    .option('--offset <number>', 'Row offset', '0')
    .option('--limit <number>', 'Rows per page (1–100)', '50')
    .description('Show connected, pending, reconnect and confirmation rows')
    .action(
      async (
        id: string,
        opts: { offset: string; limit: string },
        cmd: Command,
      ) =>
        run(cmd, (client) =>
          client.accountOnboarding.status(id, {
            offset: Number(opts.offset),
            limit: Number(opts.limit),
          }),
        ),
    )
  command
    .command('authorize <importId> <rowId>')
    .description(
      'Print a fresh approval link. Open it in your browser, select the CSV account, then check status',
    )
    .action(async (id: string, rowId: string, _opts: unknown, cmd: Command) =>
      run(cmd, (client) => client.accountOnboarding.authorize(id, rowId)),
    )
  command
    .command('confirm <importId> <rowId>')
    .requiredOption(
      '--token-id <id>',
      'Actual account tokenId from status; confirm only after comparing it with the CSV account',
    )
    .action(
      async (
        id: string,
        rowId: string,
        opts: { tokenId: string },
        cmd: Command,
      ) =>
        run(cmd, (client) =>
          client.accountOnboarding.confirm(id, rowId, opts.tokenId),
        ),
    )
  command
    .command('delete <importId>')
    .requiredOption(
      '--force',
      'Discard import progress; keeps brands and connected accounts',
    )
    .action(async (id: string, _opts: unknown, cmd: Command) =>
      run(cmd, (client) => client.accountOnboarding.remove(id)),
    )
  return command
}
