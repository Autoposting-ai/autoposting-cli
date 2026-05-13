import { Command } from 'commander'
import { execSync } from 'node:child_process'

const VERSION = '0.1.0'
const REGISTRY_URL = 'https://registry.npmjs.org/autoposting-cli/latest'

export function createUpdateCommand(): Command {
  return new Command('update')
    .description('Check for a newer version of the CLI and optionally install it')
    .option('--yes', 'Install the latest version without prompting')
    .action(async (opts: { yes?: boolean }) => {
      let latest: string
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(REGISTRY_URL, { signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) {
          console.error(`Error: registry returned HTTP ${res.status}`)
          process.exit(1)
        }
        const data = (await res.json()) as { version: string }
        latest = data.version
      } catch (err) {
        console.error(`Error: could not reach npm registry — ${(err as Error).message}`)
        process.exit(1)
      }

      if (latest === VERSION) {
        console.log(`You are already on the latest version (${VERSION}).`)
        return
      }

      console.log(`Current version: ${VERSION}`)
      console.log(`Latest version:  ${latest}`)

      if (!opts.yes) {
        console.log(`Run \`ap update --yes\` to install v${latest}.`)
        return
      }

      console.log(`Installing autoposting-cli@${latest}…`)
      try {
        execSync(`npm install -g autoposting-cli@${latest}`, { stdio: 'inherit' })
        console.log(`Updated to v${latest}.`)
      } catch (err) {
        console.error(`Error: install failed — ${(err as Error).message}`)
        process.exit(1)
      }
    })
}
