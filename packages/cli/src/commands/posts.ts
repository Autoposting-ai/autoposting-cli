import { Command } from 'commander'
import { Autoposting } from '@autoposting.ai/sdk'
import type { Platform } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import { exitCodeFromError } from '../output/exit-codes.js'

type GlobalOpts = {
  apiKey?: string
  json?: boolean
  quiet?: boolean
  format?: 'table' | 'json'
}

const VALID_PLATFORMS: readonly Platform[] = ['x', 'linkedin', 'instagram', 'threads', 'youtube']

function parsePlatforms(raw: string): Platform[] {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error('No platforms provided. Pass a comma-separated list, e.g. --platforms x,linkedin')
  }
  const invalid = parts.filter((p) => !VALID_PLATFORMS.includes(p as Platform))
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported platform(s): ${invalid.join(', ')}. Valid platforms: ${VALID_PLATFORMS.join(', ')}`,
    )
  }
  return parts as Platform[]
}

function parsePositiveInt(value: string, flag: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${flag} must be a positive integer (received "${value}").`)
  }
  return n
}

function validateScheduledAt(value: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`--at must be a valid ISO 8601 datetime (received "${value}").`)
  }
  return value
}

/**
 * Resolves the process exit code for a caught error.
 * Honours the `exitCode` property set by `resolveAuth` (exit 2 for auth errors)
 * before falling back to the SDK error class mapping.
 */
function resolveExitCode(err: unknown): number {
  const attached = (err as { exitCode?: number }).exitCode
  if (typeof attached === 'number') return attached
  return exitCodeFromError(err)
}

export function createPostsCommand(): Command {
  const posts = new Command('posts').description('Manage posts')

  // ap posts list [--brand <slug>] [--status <status>] [--limit <n>] [--page <n>]
  posts
    .command('list')
    .description('List posts')
    .option('--brand <slug>', 'Filter by brand slug')
    .option('--status <status>', 'Filter by status (draft|scheduled|published|failed)')
    .option('--limit <n>', 'Max results per page', '20')
    .option('--page <n>', 'Page number', '1')
    .action(async (opts: { brand?: string; status?: string; limit: string; page: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching posts…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.posts.list({
          brandSlug: opts.brand,
          status: opts.status as 'draft' | 'scheduled' | 'published' | 'failed' | undefined,
          limit: parsePositiveInt(opts.limit, '--limit'),
          page: parsePositiveInt(opts.page, '--page'),
        })
        spinner.stop()
        const rows = result.data.map((p) => ({
          id: p.id,
          brand: p.brandSlug,
          status: p.status,
          platforms: p.platforms.join(', '),
          text: p.text.length > 60 ? `${p.text.slice(0, 57)}…` : p.text,
          scheduledAt: p.scheduledAt ?? '—',
        }))
        printer.table(rows, ['id', 'brand', 'status', 'platforms', 'text', 'scheduledAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts get <id>
  posts
    .command('get <id>')
    .description('Get a post by ID')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const post = await client.posts.getById(id)
        spinner.stop()
        printer.log(post)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts create --brand <slug> --text <text> --platforms <x,linkedin,...>
  posts
    .command('create')
    .description('Create a new post')
    .requiredOption('--brand <slug>', 'Brand slug')
    .requiredOption('--text <text>', 'Post text content')
    .requiredOption('--platforms <list>', 'Comma-separated platforms (e.g. x,linkedin)')
    .option('--at <iso>', 'Schedule date/time (ISO 8601)')
    .option(
      '--thread <text...>',
      'Additional posts appended after --text to form a thread (X/Threads only, max 25)',
    )
    .action(
      async (
        opts: { brand: string; text: string; platforms: string; at?: string; thread?: string[] },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner('Creating post…')
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const post = await client.posts.create({
            brandSlug: opts.brand,
            text: opts.text,
            platforms: parsePlatforms(opts.platforms),
            ...(opts.at ? { scheduledAt: validateScheduledAt(opts.at) } : {}),
            ...(opts.thread && opts.thread.length > 0 ? { thread: opts.thread } : {}),
          })
          spinner.stop()
          printer.log(post)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap posts update <id> [--text <text>] [--platforms <list>] [--at <iso>]
  posts
    .command('update <id>')
    .description('Update a post')
    .option('--text <text>', 'New post text')
    .option('--platforms <list>', 'New comma-separated platforms')
    .option('--at <iso>', 'New scheduled date/time (ISO 8601)')
    .action(
      async (
        id: string,
        opts: { text?: string; platforms?: string; at?: string },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner(`Updating post "${id}"…`)
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const post = await client.posts.update(id, {
            ...(opts.text ? { text: opts.text } : {}),
            ...(opts.platforms ? { platforms: parsePlatforms(opts.platforms) } : {}),
            ...(opts.at ? { scheduledAt: validateScheduledAt(opts.at) } : {}),
          })
          spinner.stop()
          printer.log(post)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap posts delete <id> [--force]
  posts
    .command('delete <id>')
    .description('Delete a post (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete a post. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.posts.remove(id)
        spinner.stop()
        printer.log(`Post "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts publish <id>
  posts
    .command('publish <id>')
    .description('Publish a post immediately')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Publishing post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const post = await client.posts.publish(id)
        spinner.stop()
        printer.log(post)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts schedule <id> --at <iso-datetime>
  posts
    .command('schedule <id>')
    .description('Schedule a post for a specific time')
    .requiredOption('--at <iso>', 'ISO 8601 datetime to schedule the post')
    .action(async (id: string, opts: { at: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Scheduling post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const post = await client.posts.schedule(id, validateScheduledAt(opts.at))
        spinner.stop()
        printer.log(post)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts retry <id>
  posts
    .command('retry <id>')
    .description('Retry a failed post')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Retrying post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const post = await client.posts.retry(id)
        spinner.stop()
        printer.log(post)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts rewrite <id>
  posts
    .command('rewrite <id>')
    .description('AI-rewrite a post')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Rewriting post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const post = await client.posts.rewrite(id)
        spinner.stop()
        printer.log(post)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts score <id>
  posts
    .command('score <id>')
    .description('Score a post with AI feedback')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Scoring post "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.posts.score(id)
        spinner.stop()
        printer.log(result)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return posts
}
