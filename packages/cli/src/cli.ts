#!/usr/bin/env node
import { Command } from 'commander'
import { createAuthCommand } from './commands/auth.js'
import { createBrandsCommand } from './commands/brands.js'
import { createPostsCommand } from './commands/posts.js'
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
program.addCommand(createPostsCommand())

program.parse()
