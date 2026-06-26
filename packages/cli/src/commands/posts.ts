import { Command } from 'commander'
import { Autoposting, NotFoundError } from '@autoposting.ai/sdk'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import type { Spinner } from '../output/spinner.js'
import { exitCodeFromError } from '../output/exit-codes.js'
import { parsePlatforms, validateScheduledAt, buildAndCreatePost } from '../lib/post-create.js'
import { parseBulkFile, createPostsBulk } from '../lib/post-bulk.js'
import { resolveBrand } from '../auth/config-store.js'

type GlobalOpts = {
  apiKey?: string
  json?: boolean
  quiet?: boolean
  format?: 'table' | 'json'
}

function parsePositiveInt(value: string, flag: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`${flag} must be a positive integer (received "${value}").`)
  }
  return n
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
    .option('--brand <slug>', 'Filter by brand slug (defaults to the saved context)')
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
          brandSlug: resolveBrand(opts.brand) ?? undefined,
          status: opts.status as 'draft' | 'scheduled' | 'published' | 'failed' | undefined,
          limit: parsePositiveInt(opts.limit, '--limit'),
          page: parsePositiveInt(opts.page, '--page'),
        })
        spinner.stop()
        const rows = result.map((p) => ({
          id: p.id,
          brand: p.brandSlug,
          status: p.status,
          platforms: p.platforms.join(', '),
          text: p.text.length > 60 ? `${p.text.slice(0, 57)}…` : p.text,
          scheduledAt: p.scheduledAt ?? '—',
        }))
        printer.table(rows, ['id', 'brand', 'status', 'platforms', 'text', 'scheduledAt'])
      } catch (err) {
        spinner.fail()
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
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts create --brand <slug> --text <text> --platforms <x,linkedin,...>
  posts
    .command('create')
    .description('Create a new post')
    .option('--brand <slug>', 'Brand slug (defaults to the saved context: ap config set-context)')
    // Not requiredOption: --from supplies text/platforms per row. Required-ness for
    // the single-post path is enforced manually below so --from can omit them.
    .option('--text <text>', 'Post text content (required unless --from)')
    .option('--platforms <list>', 'Comma-separated platforms, e.g. x,linkedin (required unless --from)')
    .option('--from <file>', 'Create posts in bulk from a CSV or JSON file (one post per row)')
    .option('--at <iso>', 'Schedule date/time (ISO 8601)')
    .option(
      '--thread <text...>',
      'Additional posts appended after --text to form a thread (X/Threads only, max 25)',
    )
    // v0.3.3 — media
    .option('--media <path...>', 'Media file paths to attach (max 10)')
    .option('--alt-text <text...>', 'Alt text for --media files, aligned by index')
    .option('--platform-text <pairs...>', 'Per-platform text, e.g. x=Hello linkedin=World')
    .option('--platform-media <pairs...>', 'Per-platform media, e.g. instagram=photo.jpg x=banner.png')
    // v0.3.3 — YouTube
    .option('--yt-title <t>', 'YouTube video title')
    .option('--yt-description <d>', 'YouTube video description')
    .option('--yt-tags <list>', 'YouTube tags (comma-separated)')
    .option('--yt-privacy <v>', 'YouTube privacy status (public|unlisted|private)')
    .option('--yt-category <id>', 'YouTube category ID')
    .option('--yt-made-for-kids', 'Mark YouTube video as made for kids')
    // v0.3.3 — Instagram
    .option('--ig-reel', 'Post as an Instagram Reel')
    .option('--ig-share-to-feed', 'Share Reel to feed')
    .option('--ig-cover-url <url>', 'Reel cover image URL')
    .option('--ig-thumb-offset-ms <n>', 'Reel thumbnail offset in milliseconds')
    .option('--ig-collaborators <list>', 'Reel collaborator handles (comma-separated)')
    // v0.3.3 — Threads
    .option('--threads-reply-to <id>', 'Threads post ID to reply to')
    .option('--threads-reply-control <v>', 'Threads reply control (everyone|accounts_you_follow|mentioned_only)')
    // v0.3.3 — account selector
    .option('--account <p=handle|id...>', 'Target specific account per platform, e.g. x=@handle')
    // v0.3.4 — preview the resolved request without uploading or posting
    .option('--dry-run', 'Print the resolved request body without uploading media or creating the post')
    .option('--preview', 'Alias for --dry-run')
    .action(
      async (
        opts: {
          brand?: string
          text?: string
          platforms?: string
          from?: string
          at?: string
          thread?: string[]
          // v0.3.3
          media?: string[]
          altText?: string[]
          platformText?: string[]
          platformMedia?: string[]
          ytTitle?: string
          ytDescription?: string
          ytTags?: string
          ytPrivacy?: string
          ytCategory?: string
          ytMadeForKids?: boolean
          igReel?: boolean
          igShareToFeed?: boolean
          igCoverUrl?: string
          igThumbOffsetMs?: string
          igCollaborators?: string
          threadsReplyTo?: string
          threadsReplyControl?: string
          account?: string[]
          dryRun?: boolean
          preview?: boolean
        },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        // Spinner is started only after the account picker (via onBeforeNetwork) — ora's
        // repaint loop fights the interactive prompt and can obscure the selection.
        let spinner: Spinner | undefined
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })

          // ── Bulk path: --from <file> creates one post per row ──────────────
          if (opts.from) {
            const rows = parseBulkFile(opts.from)
            const records = await createPostsBulk(client, rows, {
              cliBrand: resolveBrand(opts.brand) ?? undefined,
            })
            // Truncate text only for the human table; JSON/jq/quiet keep it full
            // (lossless echo for scripting consumers).
            const truncate = printer.isTty()
            printer.table(
              records.map((r) => ({
                '#': r.index + 1,
                status: r.status,
                id: r.id || '—',
                text: truncate && r.text.length > 40 ? `${r.text.slice(0, 37)}…` : r.text,
                error: r.error,
              })),
              ['#', 'status', 'id', 'text', 'error'],
            )
            if (records.some((r) => r.status === 'failed')) {
              process.exit(1)
            }
            return
          }

          // Resolve the brand before any validation so a missing brand fails first.
          const brand = resolveBrand(opts.brand)
          if (!brand) {
            throw new Error(
              'No brand specified. Pass --brand <slug> or set a default with: ap config set-context --brand <slug>',
            )
          }
          if (!opts.text) {
            throw new Error('--text is required (or use --from <file> to create posts in bulk).')
          }
          if (!opts.platforms) {
            throw new Error('--platforms is required (or use --from <file> to create posts in bulk).')
          }

          const result = await buildAndCreatePost(
            client,
            { ...opts, brandSlug: brand, text: opts.text, platforms: opts.platforms },
            {
              // Picker reads stdin — gate on a real interactive terminal, not the
              // output mode (printer.isTty() is true even when stdin is piped).
              isTty: Boolean(process.stdin.isTTY),
              // --dry-run/--preview: resolve + validate, then return the request body
              // without uploading media or POSTing (onBeforeNetwork never fires).
              dryRun: Boolean(opts.dryRun || opts.preview),
              // Picker done — start the spinner now (covers uploads + create).
              onBeforeNetwork: () => {
                spinner = printer.spinner('Creating post…')
              },
            },
          )
          spinner?.stop()
          printer.log(result)
        } catch (err) {
          spinner?.fail()
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
          spinner.fail()
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
        spinner.fail()
        printer.error(err as Error)
        // A failed delete (after the SDK's transient-retry gives up) may have left the
        // post in place — a NotFound means it's already gone, anything else is ambiguous.
        // Tell the user to verify so a still-scheduled post isn't silently orphaned.
        // Goes to stderr in every mode — a CI/piped run needs this safety hint too.
        if (!(err instanceof NotFoundError)) {
          printer.error(`The post may not have been deleted — verify with: ap posts get "${id}"`)
        }
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
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap posts schedule <id> (--at <iso-datetime> | --cancel)
  posts
    .command('schedule <id>')
    .description('Schedule a post for a specific time, or --cancel to unschedule it')
    .option('--at <iso>', 'ISO 8601 datetime to schedule the post')
    .option('--cancel', 'Unschedule the post (return it to draft)')
    .action(async (id: string, opts: { at?: string; cancel?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(
        opts.cancel ? `Unscheduling post "${id}"…` : `Scheduling post "${id}"…`,
      )
      try {
        // Exactly one of --at / --cancel — they are opposite operations.
        if (opts.cancel && opts.at) {
          throw new Error('Cannot use --at together with --cancel — choose one.')
        }
        if (!opts.cancel && !opts.at) {
          throw new Error('Provide either --at <iso> to schedule, or --cancel to unschedule.')
        }
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const post = opts.cancel
          ? await client.posts.unschedule(id)
          : await client.posts.schedule(id, validateScheduledAt(opts.at!))
        spinner.stop()
        printer.log(post)
      } catch (err) {
        spinner.fail()
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
        spinner.fail()
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
        spinner.fail()
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
        spinner.fail()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return posts
}
