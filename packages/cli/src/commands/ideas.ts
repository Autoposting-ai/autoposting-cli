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

// The ideas/enrich domain uses `twitter` (NOT the posts domain's `x`); backend caps at 5.
const VALID_IDEA_PLATFORMS = ['twitter', 'linkedin', 'instagram', 'youtube', 'threads'] as const

function parseIdeaPlatforms(raw: string): Array<{ platform: (typeof VALID_IDEA_PLATFORMS)[number] }> {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error('No platforms provided. e.g. --platforms twitter,linkedin')
  }
  if (parts.length > 5) {
    throw new Error('At most 5 platforms allowed per enrichment request.')
  }
  const invalid = parts.filter((p) => !VALID_IDEA_PLATFORMS.includes(p as never))
  if (invalid.length > 0) {
    throw new Error(
      `Unsupported platform(s): ${invalid.join(', ')}. Valid: ${VALID_IDEA_PLATFORMS.join(', ')}`,
    )
  }
  return parts.map((platform) => ({ platform: platform as (typeof VALID_IDEA_PLATFORMS)[number] }))
}

export function createIdeasCommand(): Command {
  const ideas = new Command('ideas').description('Manage content ideas')

  // ap ideas generate [--kb <id>] [--topic <text>] [--count <n>]
  ideas
    .command('generate')
    .description('Generate content ideas')
    .option('--kb <id>', 'Knowledge base ID to draw context from')
    .option('--topic <text>', 'Topic or theme for ideas')
    .option('--count <n>', 'Number of ideas to generate', '5')
    .action(async (opts: { kb?: string; topic?: string; count: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Generating ideas…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const result = await client.ideas.generate({
          ...(opts.kb ? { kbId: opts.kb } : {}),
          ...(opts.topic ? { topic: opts.topic } : {}),
          count: parseInt(opts.count, 10),
        })
        spinner.stop()
        const rows = (result.ideas ?? []).map((i) => ({
          id: i.id ?? '—',
          platform: i.targetPlatform,
          score: i.viralityScore,
          title: i.title.length > 80 ? `${i.title.slice(0, 77)}…` : i.title,
        }))
        printer.table(rows, ['id', 'platform', 'score', 'title'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap ideas list
  ideas
    .command('list')
    .description('List all ideas')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching ideas…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.ideas.list()
        spinner.stop()
        const rows = list.items.map((i) => ({
          id: i.id,
          topic: i.topic || '—',
          platform: i.targetPlatform,
          score: i.viralityScore,
          status: i.status,
          title: i.title.length > 60 ? `${i.title.slice(0, 57)}…` : i.title,
        }))
        printer.table(rows, ['id', 'topic', 'platform', 'score', 'status', 'title'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap ideas enrich --title <t> --hook <h> --angle <a> --platforms <list> [--kb <id>]
  // Backend enriches the idea object (not an id) across 1..5 platforms; async → job id.
  ideas
    .command('enrich')
    .description('Enrich an idea into platform-ready drafts (async; returns a job ID)')
    .requiredOption('--title <text>', 'Idea title')
    .requiredOption('--hook <text>', 'Idea hook')
    .requiredOption('--angle <text>', 'Idea angle')
    .requiredOption('--platforms <list>', `Comma-separated platforms (${VALID_IDEA_PLATFORMS.join(',')})`)
    .option('--kb <id>', 'Knowledge base ID for additional context')
    .action(
      async (
        opts: { title: string; hook: string; angle: string; platforms: string; kb?: string },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner('Queuing enrichment…')
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const { jobId } = await client.ideas.enrich({
            idea: { title: opts.title, hook: opts.hook, angle: opts.angle },
            platforms: parseIdeaPlatforms(opts.platforms),
            ...(opts.kb ? { kbId: opts.kb } : {}),
          })
          spinner.stop()
          printer.log(`Enrichment queued. Job ID: ${jobId}`)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap ideas delete <id> [--force]
  ideas
    .command('delete <id>')
    .description('Delete an idea (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete an idea. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting idea "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.ideas.remove(id)
        spinner.stop()
        printer.log(`Idea "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return ideas
}
