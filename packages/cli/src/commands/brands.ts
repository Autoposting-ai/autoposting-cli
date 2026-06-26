import { Command } from 'commander'
import { Autoposting } from '@autoposting.ai/sdk'
import type { PlatformConnection } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import { exitCodeFromError } from '../output/exit-codes.js'
import { parsePairs } from '../lib/media-flags.js'
import {
  getDefaultAccounts,
  setDefaultAccount,
  clearDefaultAccounts,
} from '../auth/config-store.js'

/**
 * Classify a platform connection's token. A connection is only "ok" when it's
 * connected, has no refresh failure, and isn't past its expiry — otherwise the
 * token can't actually post, so reporting "ok" (the old behavior) was misleading.
 */
export function tokenStatus(c: PlatformConnection, now: number = Date.now()): string {
  if (!c.connected) return '—'
  if (c.refreshError) return 'expired'
  if (c.expiresAt) {
    const expMs = Date.parse(c.expiresAt)
    if (Number.isNaN(expMs) || expMs <= now) return 'expired'
  }
  return 'ok'
}

export function buildAuthStatusRow(c: PlatformConnection, now: number = Date.now()) {
  return {
    platform: c.platform,
    connected: c.connected ? 'yes' : 'no',
    username: c.platformUsername ?? '—',
    'token status': tokenStatus(c, now),
    expires: c.expiresAt ?? '—',
  }
}

export function createBrandsCommand(): Command {
  const brands = new Command('brands').description('Manage brands')

  // ap brands list
  brands
    .command('list')
    .description('List all brands')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        apiKey?: string
        json?: boolean
        quiet?: boolean
        format?: 'table' | 'json'
      }>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching brands…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.brands.list()
        spinner.stop()
        const rows = list.map((b) => ({
          slug: b.slug,
          name: b.name,
          platforms: b.platforms
            .filter((p) => p.connected)
            .map((p) => p.platform)
            .join(', ') || '—',
          timezone: b.timezone,
        }))
        printer.table(rows, ['slug', 'name', 'platforms', 'timezone'])
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(exitCodeFromError(err))
      }
    })

  // ap brands get <slug>
  brands
    .command('get <slug>')
    .description('Get a brand by slug')
    .action(async (slug: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        apiKey?: string
        json?: boolean
        quiet?: boolean
        format?: 'table' | 'json'
      }>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching brand "${slug}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const brand = await client.brands.retrieve(slug)
        spinner.stop()
        printer.log(brand)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(exitCodeFromError(err))
      }
    })

  // ap brands create --name <name> [--timezone <tz>]
  brands
    .command('create')
    .description('Create a new brand')
    .requiredOption('--name <name>', 'Brand display name')
    .option('--timezone <tz>', 'IANA timezone (e.g. America/New_York)')
    .action(async (opts: { name: string; timezone?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        apiKey?: string
        json?: boolean
        quiet?: boolean
        format?: 'table' | 'json'
      }>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Creating brand…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const brand = await client.brands.create({
          name: opts.name,
          ...(opts.timezone ? { timezone: opts.timezone } : {}),
        })
        spinner.stop()
        printer.log(brand)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(exitCodeFromError(err))
      }
    })

  // ap brands update <slug> [--name <name>] [--timezone <tz>]
  brands
    .command('update <slug>')
    .description('Update a brand')
    .option('--name <name>', 'New display name')
    .option('--timezone <tz>', 'New IANA timezone')
    .action(async (slug: string, opts: { name?: string; timezone?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        apiKey?: string
        json?: boolean
        quiet?: boolean
        format?: 'table' | 'json'
      }>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Updating brand "${slug}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const brand = await client.brands.update(slug, {
          ...(opts.name ? { name: opts.name } : {}),
          ...(opts.timezone ? { timezone: opts.timezone } : {}),
        })
        spinner.stop()
        printer.log(brand)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(exitCodeFromError(err))
      }
    })

  // ap brands delete <slug> [--force]
  brands
    .command('delete <slug>')
    .description('Delete a brand (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (slug: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        apiKey?: string
        json?: boolean
        quiet?: boolean
        format?: 'table' | 'json'
      }>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete a brand. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting brand "${slug}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.brands.remove(slug)
        spinner.stop()
        printer.log(`Brand "${slug}" deleted.`)
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(exitCodeFromError(err))
      }
    })

  // ap brands auth-status <slug>
  brands
    .command('auth-status <slug>')
    .description('Show platform connection status for a brand')
    .action(async (slug: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{
        apiKey?: string
        json?: boolean
        quiet?: boolean
        format?: 'table' | 'json'
      }>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching auth status for "${slug}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const connections = await client.brands.authStatus(slug)
        spinner.stop()
        const rows = connections.map((c) => buildAuthStatusRow(c))
        printer.table(rows, ['platform', 'connected', 'username', 'token status', 'expires'])
      } catch (err) {
        spinner.fail()
        printer.error(err as Error)
        process.exit(exitCodeFromError(err))
      }
    })

  // ap brands set-default-account <slug> <p=handle|id|all...>
  // Local-only: saves the account to target per platform when --account is omitted.
  brands
    .command('set-default-account <slug> <pairs...>')
    .description('Save default target account(s) for a brand, e.g. x=@handle linkedin=all')
    .action((slug: string, pairs: string[], _opts: Record<string, unknown>, cmd: Command) => {
      const printer = createPrinter(cmd.optsWithGlobals())
      try {
        const parsed = parsePairs('--account', pairs)
        for (const [platform, value] of Object.entries(parsed)) {
          setDefaultAccount(slug, platform as keyof typeof parsed, value as string)
        }
        printer.log(getDefaultAccounts(slug))
      } catch (err) {
        printer.error(err as Error)
        process.exit(1)
      }
    })

  // ap brands get-default-account <slug>
  brands
    .command('get-default-account <slug>')
    .description('Show saved default account(s) for a brand')
    .action((slug: string, _opts: Record<string, unknown>, cmd: Command) => {
      const printer = createPrinter(cmd.optsWithGlobals())
      printer.log(getDefaultAccounts(slug))
    })

  // ap brands clear-default-account <slug>
  brands
    .command('clear-default-account <slug>')
    .description('Remove all saved default accounts for a brand')
    .action((slug: string, _opts: Record<string, unknown>, cmd: Command) => {
      const printer = createPrinter(cmd.optsWithGlobals())
      clearDefaultAccounts(slug)
      printer.log(getDefaultAccounts(slug))
    })

  return brands
}
