import { Command } from 'commander'
import { createPrinter } from '../output/printer.js'
import { getContextBrand, setContextBrand, unsetContextBrand } from '../auth/config-store.js'

type GlobalOpts = {
  json?: boolean
  quiet?: boolean
  format?: 'auto' | 'table' | 'json'
  jq?: string
}

export function createConfigCommand(): Command {
  const config = new Command('config').description('Manage CLI defaults (stored in config.json)')

  // ap config set-context --brand <slug>
  config
    .command('set-context')
    .description('Set the default brand used when --brand is omitted')
    .requiredOption('--brand <slug>', 'Brand slug to use as the default context')
    .action((opts: { brand: string }, cmd: Command) => {
      const printer = createPrinter(cmd.optsWithGlobals<GlobalOpts>())
      setContextBrand(opts.brand)
      printer.log({ brand: opts.brand })
    })

  // ap config get-context
  config
    .command('get-context')
    .description('Show the default brand context')
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      const printer = createPrinter(cmd.optsWithGlobals<GlobalOpts>())
      const brand = getContextBrand()
      if (!brand) {
        printer.error('No brand context set. Set one with: ap config set-context --brand <slug>')
        process.exit(1)
      }
      printer.log({ brand })
    })

  // ap config unset-context
  config
    .command('unset-context')
    .description('Clear the default brand context')
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      const printer = createPrinter(cmd.optsWithGlobals<GlobalOpts>())
      unsetContextBrand()
      printer.log({ brand: null })
    })

  return config
}
