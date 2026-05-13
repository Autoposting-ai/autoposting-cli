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

export function createAgentsCommand(): Command {
  const agents = new Command('agents').description('Manage agents')

  // ap agents list
  agents
    .command('list')
    .description('List all agents')
    .action(async (_opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner('Fetching agents…')
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.agents.list()
        spinner.stop()
        const rows = list.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          brand: a.brandSlug ?? '—',
          frequency: a.frequency,
          enabled: a.enabled ? 'yes' : 'no',
        }))
        printer.table(rows, ['id', 'name', 'type', 'brand', 'frequency', 'enabled'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap agents get <id>
  agents
    .command('get <id>')
    .description('Get an agent by ID')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching agent "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const agent = await client.agents.retrieve(id)
        spinner.stop()
        printer.log(agent)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap agents create --name <name> --type <publish|research> [--brand <slug>] --prompt <text> --frequency <manual|daily|weekly>
  agents
    .command('create')
    .description('Create a new agent')
    .requiredOption('--name <name>', 'Agent name')
    .requiredOption('--type <type>', 'Agent type: publish or research')
    .option('--brand <slug>', 'Brand slug to associate with')
    .requiredOption('--prompt <text>', 'Agent prompt / instructions')
    .requiredOption('--frequency <freq>', 'Run frequency: manual, daily, or weekly')
    .option('--time <HH:MM>', 'Time of day to run (required for daily/weekly)')
    .option('--weekday <day>', 'Day of week to run (required for weekly)')
    .option('--kb <id>', 'Knowledge base ID to attach')
    .action(
      async (
        opts: {
          name: string
          type: string
          brand?: string
          prompt: string
          frequency: string
          time?: string
          weekday?: string
          kb?: string
        },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner('Creating agent…')
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const agent = await client.agents.create({
            name: opts.name,
            type: opts.type as 'publish' | 'research',
            prompt: opts.prompt,
            frequency: opts.frequency as 'manual' | 'daily' | 'weekly',
            ...(opts.brand ? { brandSlug: opts.brand } : {}),
            ...(opts.time ? { time: opts.time } : {}),
            ...(opts.weekday ? { weekday: opts.weekday } : {}),
            ...(opts.kb ? { kbId: opts.kb } : {}),
          })
          spinner.stop()
          printer.log(agent)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap agents update <id> [--name] [--prompt] [--frequency] [--time] [--weekday]
  agents
    .command('update <id>')
    .description('Update an agent')
    .option('--name <name>', 'New agent name')
    .option('--prompt <text>', 'New prompt / instructions')
    .option('--frequency <freq>', 'New frequency: manual, daily, or weekly')
    .option('--time <HH:MM>', 'New time of day')
    .option('--weekday <day>', 'New day of week')
    .action(
      async (
        id: string,
        opts: { name?: string; prompt?: string; frequency?: string; time?: string; weekday?: string },
        cmd: Command,
      ) => {
        const globals = cmd.optsWithGlobals<GlobalOpts>()
        const printer = createPrinter(globals)
        const spinner = printer.spinner(`Updating agent "${id}"…`)
        try {
          const cred = resolveAuth({ apiKey: globals.apiKey })
          const client = new Autoposting({ apiKey: cred.apiKey })
          const agent = await client.agents.update(id, {
            ...(opts.name ? { name: opts.name } : {}),
            ...(opts.prompt ? { prompt: opts.prompt } : {}),
            ...(opts.frequency ? { frequency: opts.frequency } : {}),
            ...(opts.time ? { time: opts.time } : {}),
            ...(opts.weekday ? { weekday: opts.weekday } : {}),
          })
          spinner.stop()
          printer.log(agent)
        } catch (err) {
          spinner.stop()
          printer.error(err as Error)
          process.exit(resolveExitCode(err))
        }
      },
    )

  // ap agents delete <id> --force
  agents
    .command('delete <id>')
    .description('Delete an agent (requires --force)')
    .option('--force', 'Confirm deletion without interactive prompt')
    .action(async (id: string, opts: { force?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      if (!opts.force) {
        printer.error('--force is required to delete an agent. Pass --force to confirm.')
        process.exit(1)
      }
      const spinner = printer.spinner(`Deleting agent "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        await client.agents.remove(id)
        spinner.stop()
        printer.log(`Agent "${id}" deleted.`)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap agents run <id>
  agents
    .command('run <id>')
    .description('Trigger an agent run immediately')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Running agent "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const agentRun = await client.agents.run(id)
        spinner.stop()
        printer.log(agentRun)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap agents toggle <id>
  agents
    .command('toggle <id>')
    .description('Enable or disable an agent')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Toggling agent "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const agent = await client.agents.toggle(id)
        spinner.stop()
        printer.log(agent)
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  // ap agents runs <id>
  agents
    .command('runs <id>')
    .description('List run history for an agent')
    .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
      const globals = cmd.optsWithGlobals<GlobalOpts>()
      const printer = createPrinter(globals)
      const spinner = printer.spinner(`Fetching runs for agent "${id}"…`)
      try {
        const cred = resolveAuth({ apiKey: globals.apiKey })
        const client = new Autoposting({ apiKey: cred.apiKey })
        const list = await client.agents.runs(id)
        spinner.stop()
        const rows = list.map((r) => ({
          id: r.id,
          status: r.status,
          output: r.output ? (r.output.length > 60 ? `${r.output.slice(0, 57)}…` : r.output) : '—',
          createdAt: r.createdAt,
        }))
        printer.table(rows, ['id', 'status', 'output', 'createdAt'])
      } catch (err) {
        spinner.stop()
        printer.error(err as Error)
        process.exit(resolveExitCode(err))
      }
    })

  return agents
}
