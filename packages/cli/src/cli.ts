#!/usr/bin/env node
import { Command } from 'commander'
import { createAgentsCommand } from './commands/agents.js'
import { createAuthCommand } from './commands/auth.js'
import { createBillingCommand } from './commands/billing.js'
import { createBrandsCommand } from './commands/brands.js'
import { createCarouselsCommand } from './commands/carousels.js'
import { createClipsCommand } from './commands/clips.js'
import { createPostsCommand } from './commands/posts.js'
import { createKbCommand } from './commands/kb.js'
import { createIdeasCommand } from './commands/ideas.js'
import { createUsageCommand } from './commands/usage.js'
import { createWebhooksCommand } from './commands/webhooks.js'
import { createWorkspacesCommand } from './commands/workspaces.js'
import { createDoctorCommand } from './commands/doctor.js'
import { createWhoamiCommand } from './commands/whoami.js'
import { createOpenCommand } from './commands/open.js'
import { createUpdateCommand } from './commands/update.js'
import { createCompletionCommand } from './commands/completion.js'
import { createMcpCommand } from './commands/mcp.js'
import { disableColor } from './output/index.js'

const program = new Command()
  .name('autoposting')
  .description('Autoposting CLI — manage social media from the terminal')
  .version('0.1.0')
  .option('--json', 'Output as JSON')
  .option('--quiet', 'Suppress spinners and non-essential output')
  .option('--format <type>', 'Output format: table, json', 'table')
  .option('--api-key <key>', 'API key (overrides env/stored credentials)')
  .option('--no-color', 'Disable color output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts<{ color: boolean }>()
    if (!opts.color) disableColor()
  })

program.addCommand(createAuthCommand())
program.addCommand(createBillingCommand())
program.addCommand(createBrandsCommand())
program.addCommand(createCarouselsCommand())
program.addCommand(createClipsCommand())
program.addCommand(createPostsCommand())
program.addCommand(createAgentsCommand())
program.addCommand(createKbCommand())
program.addCommand(createIdeasCommand())
program.addCommand(createUsageCommand())
program.addCommand(createWebhooksCommand())
program.addCommand(createWorkspacesCommand())
program.addCommand(createDoctorCommand())
program.addCommand(createWhoamiCommand())
program.addCommand(createOpenCommand())
program.addCommand(createUpdateCommand())
program.addCommand(createCompletionCommand())
program.addCommand(createMcpCommand())

program.parse()
