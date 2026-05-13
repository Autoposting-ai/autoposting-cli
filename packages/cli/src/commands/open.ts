import { Command } from 'commander'
import open from 'open'

const URLS: Record<string, string> = {
  '': 'https://app.autoposting.ai',
  posts: 'https://app.autoposting.ai/posts',
  brands: 'https://app.autoposting.ai/brands',
  agents: 'https://app.autoposting.ai/agents',
  settings: 'https://app.autoposting.ai/settings',
  billing: 'https://app.autoposting.ai/settings/billing',
}

const VALID_SECTIONS = Object.keys(URLS).filter((k) => k !== '')

export function createOpenCommand(): Command {
  return new Command('open')
    .description(`Open the Autoposting dashboard in your browser. Sections: ${VALID_SECTIONS.join(', ')}`)
    .argument('[section]', `Dashboard section to open (${VALID_SECTIONS.join('|')})`, '')
    .option('--no-browser', 'Print URL only, do not open browser')
    .action(async (section: string, opts: { browser: boolean }) => {
      const key = section ?? ''
      if (!(key in URLS)) {
        console.error(`Error: unknown section "${key}". Valid sections: ${VALID_SECTIONS.join(', ')}`)
        process.exit(1)
      }

      const url = URLS[key]

      if (!opts.browser) {
        console.log(url)
        return
      }

      console.log(`Opening ${url}`)
      try {
        await open(url)
      } catch (err) {
        console.error(`Error: failed to open browser — ${(err as Error).message}`)
        console.log(`Visit manually: ${url}`)
        process.exit(1)
      }
    })
}
