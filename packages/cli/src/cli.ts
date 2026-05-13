#!/usr/bin/env node
import { Command } from 'commander'
import { createAgentsCommand } from './commands/agents.js'
import { createAuthCommand } from './commands/auth.js'
import { createBrandsCommand } from './commands/brands.js'
import { createCarouselsCommand } from './commands/carousels.js'
import { createClipsCommand } from './commands/clips.js'
import { createPostsCommand } from './commands/posts.js'
import { createKbCommand } from './commands/kb.js'
import { createIdeasCommand } from './commands/ideas.js'
import { createWebhooksCommand } from './commands/webhooks.js'
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
program.addCommand(createBrandsCommand())
program.addCommand(createCarouselsCommand())
program.addCommand(createClipsCommand())
program.addCommand(createPostsCommand())
program.addCommand(createAgentsCommand())
program.addCommand(createKbCommand())
program.addCommand(createIdeasCommand())
program.addCommand(createWebhooksCommand())

program.parse()
