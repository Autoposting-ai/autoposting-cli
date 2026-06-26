import { Command } from 'commander'
import { Autoposting, NotFoundError } from '@autoposting.ai/sdk'
import type { Platform } from '@autoposting.ai/sdk'
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { resolveAuth } from '../auth/auth-manager.js'
import { createPrinter } from '../output/printer.js'
import type { Spinner } from '../output/spinner.js'
import { exitCodeFromError } from '../output/exit-codes.js'
import {
  extToMime,
  parsePairs,
  parsePlatformMediaPairs,
  validateMediaCount,
  validateMediaPaths,
  validateMediaExtensions,
  alignAltText,
  buildYoutubeOptions,
  buildInstagramOptions,
  buildThreadsOptions,
} from '../lib/media-flags.js'
import type { MediaInput } from '@autoposting.ai/sdk'
import { resolveTargetAccounts } from '../lib/account-select.js'

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
  // Require a real ISO 8601 datetime. Date.parse alone is lenient (accepts locale formats
  // like "01/02/2026"), so also require the YYYY-MM-DDTHH:MM prefix the API expects.
  const ms = Date.parse(value)
  if (Number.isNaN(ms) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new Error(
      `--at must be a valid ISO 8601 datetime, e.g. 2026-06-30T14:00:00Z (received "${value}").`,
    )
  }
  // A past time means the post would publish immediately on submit — almost never intended,
  // and irreversible for an instant publish. Reject it here, before any create/schedule call.
  if (ms <= Date.now()) {
    throw new Error(
      `--at must be in the future (received "${value}", which is in the past). ` +
        `A past schedule time publishes immediately.`,
    )
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
    .requiredOption('--brand <slug>', 'Brand slug')
    .requiredOption('--text <text>', 'Post text content')
    .requiredOption('--platforms <list>', 'Comma-separated platforms (e.g. x,linkedin)')
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
    .action(
      async (
        opts: {
          brand: string
          text: string
          platforms: string
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
        },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        // Spinner is started only after the account picker (see below) — ora's
        // repaint loop fights the interactive prompt and can obscure the selection.
        let spinner: Spinner | undefined
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })

          // ── Pure validation pass (all synchronous/disk-only) ──────────────
          // Must run before any network call so errors are clear and fast.
          const platforms = parsePlatforms(opts.platforms)
          const scheduledAt = opts.at ? validateScheduledAt(opts.at) : undefined

          if (opts.media && opts.media.length > 0) {
            validateMediaCount(opts.media)
            validateMediaPaths(opts.media)
            validateMediaExtensions(opts.media)
          }

          const platformTexts =
            opts.platformText && opts.platformText.length > 0
              ? parsePairs('--platform-text', opts.platformText)
              : undefined

          // Parse platform-media pairs up front (validate format + paths before upload).
          const platformMediaPaths =
            opts.platformMedia && opts.platformMedia.length > 0
              ? parsePlatformMediaPairs('--platform-media', opts.platformMedia)
              : {}
          for (const paths of Object.values(platformMediaPaths)) {
            validateMediaPaths(paths)
            validateMediaExtensions(paths)
          }

          // Validate alt-text count against media count before any upload.
          const altTexts = alignAltText(opts.media ?? [], opts.altText ?? [])

          const youtubeOptions = buildYoutubeOptions({
            ytTitle: opts.ytTitle,
            ytDescription: opts.ytDescription,
            ytTags: opts.ytTags,
            ytPrivacy: opts.ytPrivacy,
            ytCategory: opts.ytCategory,
            ytMadeForKids: opts.ytMadeForKids,
          })
          const instagramOptions = buildInstagramOptions({
            igReel: opts.igReel,
            igShareToFeed: opts.igShareToFeed,
            igCoverUrl: opts.igCoverUrl,
            igThumbOffsetMs: opts.igThumbOffsetMs,
            igCollaborators: opts.igCollaborators,
          })
          const threadsOptions = buildThreadsOptions({
            threadsReplyTo: opts.threadsReplyTo,
            threadsReplyControl: opts.threadsReplyControl,
          })

          // ── Network calls ─────────────────────────────────────────────────
          const targetAccountIds = await resolveTargetAccounts({
            brandSlug: opts.brand,
            platforms,
            accountFlags: opts.account ?? [],
            client,
            // Picker reads stdin — gate on a real interactive terminal, not the
            // output mode (printer.isTty() is true even when stdout/stdin is piped).
            isTty: Boolean(process.stdin.isTTY),
          })

          // Picker done — safe to animate the spinner now (covers uploads + create).
          spinner = printer.spinner('Creating post…')

          // Upload global media.
          const mediaInputs: MediaInput[] = []
          for (let i = 0; i < (opts.media ?? []).length; i++) {
            const filePath = opts.media![i]
            const data = await fs.readFile(filePath)
            const filename = nodePath.basename(filePath)
            const contentType = extToMime(filename)
            const uploaded = await client.media.upload({
              data: new Uint8Array(data),
              filename,
              contentType,
            })
            mediaInputs.push({
              url: uploaded.url,
              type: uploaded.type,
              ...(altTexts[i] ? { altText: altTexts[i] } : {}),
            })
          }

          // Upload per-platform media.
          const platformMediaResult: Partial<Record<Platform, MediaInput[]>> = {}
          for (const [p, paths] of Object.entries(platformMediaPaths) as [Platform, string[]][]) {
            const uploads: MediaInput[] = []
            for (const filePath of paths) {
              const data = await fs.readFile(filePath)
              const filename = nodePath.basename(filePath)
              const contentType = extToMime(filename)
              const uploaded = await client.media.upload({
                data: new Uint8Array(data),
                filename,
                contentType,
              })
              uploads.push({ url: uploaded.url, type: uploaded.type })
            }
            platformMediaResult[p] = uploads
          }

          const post = await client.posts.create({
            brandSlug: opts.brand,
            text: opts.text,
            platforms,
            ...(scheduledAt ? { scheduledAt } : {}),
            ...(opts.thread && opts.thread.length > 0 ? { thread: opts.thread } : {}),
            ...(mediaInputs.length > 0 ? { media: mediaInputs } : {}),
            ...(Object.keys(platformMediaResult).length > 0
              ? { platformMedia: platformMediaResult }
              : {}),
            ...(platformTexts && Object.keys(platformTexts).length > 0
              ? { platformTexts }
              : {}),
            ...(Object.keys(targetAccountIds).length > 0
              ? { targetAccountIds }
              : {}),
            ...(instagramOptions ? { instagramOptions } : {}),
            ...(threadsOptions ? { threadsOptions } : {}),
            ...(youtubeOptions ? { youtubeOptions } : {}),
            source: 'cli',
          })
          spinner.stop()
          printer.log(post)
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
        if (!(err instanceof NotFoundError) && printer.isTty()) {
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
